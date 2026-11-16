#!/usr/bin/env python3
"""
CAD-001 offline logic test: a minimal AutoLISP interpreter + a mock of the
AutoCAD ActiveX object model, enough to EXECUTE CAD001_ROOM.lsp on Linux.

What this proves
  * the .lsp parses (balanced parens, valid strings/comments)
  * every function it calls exists in the subset below (typos fail loudly)
  * the arithmetic produces the intended coordinates / dimension values
  * the pre-flight checks stop the run on locked/frozen/off layers
  * the rollback removes only objects created by the run

What this does NOT prove
  * that real AutoCAD accepts every call (argument types, enum constants,
    property names) - the mock is written from the AutoCAD ActiveX reference,
    not from AutoCAD itself.  Real-machine testing is still required.

Usage:  python3 alisp_sim.py CAD001_ROOM.lsp OUT_DIR
"""
import json
import math
import re
import sys


# ---------------------------------------------------------------- reader --
class Sym(str):
    pass


class Pair:
    """dotted pair (a . b) where b is not a list"""
    def __init__(self, a, b):
        self.car, self.cdr = a, b

    def __repr__(self):
        return f"({self.car!r} . {self.cdr!r})"


class LispError(Exception):
    pass


TOKEN = re.compile(r'''\s*(?:(;\|.*?\|;)|(;[^\n]*)|("(?:\\.|[^"\\])*")|(\(|\)|')|([^\s()';"]+))''', re.S)


def tokenize(src):
    pos, out = 0, []
    while pos < len(src):
        m = TOKEN.match(src, pos)
        if not m or m.end() == pos:
            if src[pos:].strip() == "":
                break
            raise LispError(f"tokenize error at offset {pos}: {src[pos:pos+30]!r}")
        pos = m.end()
        if m.group(1) or m.group(2):
            continue
        if m.group(3):
            s = m.group(3)[1:-1]
            s = s.replace('\\n', '\n').replace('\\t', '\t').replace('\\"', '"').replace('\\\\', '\\')
            out.append(("str", s))
        elif m.group(4):
            out.append(("punc", m.group(4)))
        elif m.group(5):
            out.append(("atom", m.group(5)))
    return out


def parse(tokens):
    pos = 0

    def read():
        nonlocal pos
        if pos >= len(tokens):
            raise LispError("unexpected end of file - missing ')'")
        kind, val = tokens[pos]
        pos += 1
        if kind == "str":
            return val
        if val == "(":
            lst = []
            while True:
                if pos >= len(tokens):
                    raise LispError("unbalanced parentheses: missing ')'")
                if tokens[pos] == ("punc", ")"):
                    pos += 1
                    return lst
                if tokens[pos] == ("atom", "."):
                    pos += 1
                    tail = read()
                    if tokens[pos] != ("punc", ")"):
                        raise LispError("bad dotted pair")
                    pos += 1
                    return ["__DOTTED__", lst, tail]
                lst.append(read())
        if val == ")":
            raise LispError(f"unbalanced parentheses: extra ')' at token {pos}")
        if val == "'":
            return [Sym("QUOTE"), read()]
        try:
            return int(val)
        except ValueError:
            pass
        try:
            return float(val)
        except ValueError:
            pass
        return Sym(val.upper())

    forms = []
    while pos < len(tokens):
        forms.append(read())
    return forms


# ---------------------------------------------------------- mock AutoCAD --
T = Sym("T")
VTRUE, VFALSE = ":VLAX-TRUE", ":VLAX-FALSE"


class Variant:
    def __init__(self, v):
        self.value = v


class SafeArray:
    def __init__(self, n):
        self.items = [0.0] * n


class ComError(Exception):
    pass


class AcadObject:
    _next_handle = [0x200]

    def __init__(self, objname, **props):
        self.ObjectName = objname
        self.props = dict(props)
        self.Handle = format(AcadObject._next_handle[0], "X")
        AcadObject._next_handle[0] += 1
        self.deleted = False

    def get(self, p):
        if p == "ObjectName":
            return self.ObjectName
        if p == "Handle":
            return self.Handle
        if p not in self.props:
            raise ComError(f"{self.ObjectName}: unknown property {p}")
        return self.props[p]

    def put(self, p, v):
        if p not in self.WRITABLE.get(self.ObjectName, ()):
            raise ComError(f"{self.ObjectName}: property {p} not writable / unknown")
        self.props[p] = v


AcadObject.WRITABLE = {
    "AcDbPolyline": ("Layer", "Closed"),
    "AcDbLine": ("Layer",),
    "AcDbArc": ("Layer",),
    "AcDbText": ("Layer",),
    "AcDbRotatedDimension": ("Layer", "TextHeight", "ArrowheadSize", "Arrowhead1Type",
                             "Arrowhead2Type", "ExtensionLineOffset", "ExtensionLineExtend",
                             "TextGap", "PrimaryUnitsPrecision"),
    "AcDbLayerTableRecord": ("Color", "Lineweight", "Description", "LayerOn", "Freeze", "Lock"),
}


class Drawing:
    def __init__(self, preexisting_layers=None, preexisting_entities=0):
        self.layers = {"0": AcadObject("AcDbLayerTableRecord", Name="0", LayerOn=VTRUE,
                                       Freeze=VFALSE, Lock=VFALSE, Color=7)}
        for name, props in (preexisting_layers or {}).items():
            d = dict(Name=name, LayerOn=VTRUE, Freeze=VFALSE, Lock=VFALSE, Color=1)
            d.update(props)
            self.layers[name.upper()] = AcadObject("AcDbLayerTableRecord", **d)
        self.ms = []
        for i in range(preexisting_entities):
            self.ms.append(AcadObject("AcDbLine", Layer="0", StartPoint=[0, i * 10, 0],
                                      EndPoint=[100, i * 10, 0]))
        self.undo = []
        self.sysvars = {"WORLDUCS": 1, "INSUNITS": 4, "CLAYER": "0", "OSMODE": 4133,
                        "ACADVER": "<mock>", "PRODUCT": "<mock>", "LISPSYS": 1}
        self.fail_after = None          # inject an error after N entities


def to_pt(v):
    if isinstance(v, Variant):
        v = v.value
    if isinstance(v, SafeArray):
        v = v.items
    return [float(x) for x in v]


# ------------------------------------------------------------ interpreter --
class Func:
    def __init__(self, params, locals_, body, env, name="lambda"):
        self.params, self.locals, self.body, self.env, self.name = params, locals_, body, env, name


def nil(x):
    return x is None or x == [] or x is False


def lisp_bool(b):
    return T if b else None


class Interp:
    def __init__(self, dwg, getpoint_answer=None):
        self.g = {}
        self.dwg = dwg
        self.out = []
        self.getpoint_answer = getpoint_answer
        self.trace = []
        self.g[T] = T
        self.g[Sym("PI")] = math.pi
        self.g[Sym("VLAX-VBDOUBLE")] = 5
        self.g[Sym(":VLAX-TRUE")] = VTRUE
        self.g[Sym(":VLAX-FALSE")] = VFALSE
        # AutoCAD type-library constants used by the lsp (values from the
        # AutoCAD ActiveX reference: AcDimArrowheadType / AcDimPrecision)
        self.g[Sym("ACARROWARCHTICK")] = 4
        self.g[Sym("ACDIMPRECISIONZERO")] = 0
        self.builtins = self._builtins()

    # -- environment
    def lookup(self, s, env):
        e = env
        while e is not None:
            if s in e[0]:
                return e[0][s]
            e = e[1]
        if s in self.g:
            return self.g[s]
        if s in self.builtins:
            return self.builtins[s]
        if s.startswith("VLA-"):
            return ("VLA", s)
        return None   # unbound symbol = nil in AutoLISP

    def setq(self, s, v, env):
        e = env
        while e is not None:
            if s in e[0]:
                e[0][s] = v
                return
            e = e[1]
        self.g[s] = v

    # -- eval
    def eval(self, x, env=None):
        if isinstance(x, Sym):
            if x == "NIL":
                return None
            return self.lookup(x, env)
        if not isinstance(x, list):
            return x
        if not x:
            return None
        if x[0] == "__DOTTED__":
            return x
        h = x[0]
        if isinstance(h, Sym):
            sf = getattr(self, "sf_" + h.replace("-", "_").replace("*", "S").replace(":", "_"), None)
            if sf and h in ("QUOTE", "SETQ", "DEFUN", "IF", "COND", "PROGN", "WHILE", "FOREACH",
                            "LAMBDA", "AND", "OR", "REPEAT", "FUNCTION", "VLAX-FOR"):
                return sf(x, env)
        f = self.eval(h, env)
        args = [self.eval(a, env) for a in x[1:]]
        return self.apply(f, args, h)

    def apply(self, f, args, name="?"):
        if isinstance(f, Func):
            frame = {}
            if len(args) != len(f.params):
                raise LispError(f"{f.name}: too few/many arguments ({len(args)} for {len(f.params)})")
            for p, a in zip(f.params, args):
                frame[p] = a
            for l in f.locals:
                frame[l] = None
            env = (frame, f.env)
            res = None
            for form in f.body:
                res = self.eval(form, env)
            return res
        if callable(f):
            return f(*args)
        if isinstance(f, tuple) and f[0] == "VLA":
            return self.vla(f[1], args)
        if isinstance(f, Sym):
            return self.apply(self.lookup(f, None), args, f)
        raise LispError(f"no function definition: {name}")

    # -- special forms
    def sf_QUOTE(self, x, env):
        q = x[1]
        if isinstance(q, Sym) and q == "NIL":
            return None
        if isinstance(q, list) and q and q[0] == "__DOTTED__":
            return Pair(q[1][0] if len(q[1]) == 1 else q[1], q[2])
        return q

    def sf_FUNCTION(self, x, env):
        return self.eval(x[1], env) if isinstance(x[1], list) else self.lookup(x[1], env)

    def sf_SETQ(self, x, env):
        v = None
        for i in range(1, len(x), 2):
            v = self.eval(x[i + 1], env)
            self.setq(x[i], v, env)
        return v

    def _params(self, plist):
        params, locs, after = [], [], False
        for p in plist:
            if p == "/":
                after = True
            elif after:
                locs.append(p)
            else:
                params.append(p)
        return params, locs

    def sf_DEFUN(self, x, env):
        name = x[1]
        params, locs = self._params(x[2])
        fn = Func(params, locs, x[3:], env if env is not None and name == "*ERROR*" else None, name)
        self.setq(name, fn, env) if name == "*ERROR*" else self.g.__setitem__(name, fn)
        return name

    def sf_LAMBDA(self, x, env):
        params, locs = self._params(x[1])
        return Func(params, locs, x[2:], env)

    def sf_IF(self, x, env):
        if not nil(self.eval(x[1], env)):
            return self.eval(x[2], env)
        return self.eval(x[3], env) if len(x) > 3 else None

    def sf_COND(self, x, env):
        for clause in x[1:]:
            t = self.eval(clause[0], env)
            if not nil(t):
                res = t
                for f in clause[1:]:
                    res = self.eval(f, env)
                return res
        return None

    def sf_PROGN(self, x, env):
        res = None
        for f in x[1:]:
            res = self.eval(f, env)
        return res

    def sf_AND(self, x, env):
        for f in x[1:]:
            if nil(self.eval(f, env)):
                return None
        return T

    def sf_OR(self, x, env):
        for f in x[1:]:
            if not nil(self.eval(f, env)):
                return T
        return None

    def sf_WHILE(self, x, env):
        res = None
        while not nil(self.eval(x[1], env)):
            for f in x[2:]:
                res = self.eval(f, env)
        return res

    def sf_REPEAT(self, x, env):
        res = None
        for _ in range(int(self.eval(x[1], env))):
            for f in x[2:]:
                res = self.eval(f, env)
        return res

    def sf_FOREACH(self, x, env):
        var, lst = x[1], self.eval(x[2], env)
        frame = {var: None}
        e2 = (frame, env)
        res = None
        for item in (lst or []):
            frame[var] = item
            for f in x[3:]:
                res = self.eval(f, e2)
        return res

    def sf_VLAX_FOR(self, x, env):
        var, coll = x[1], self.eval(x[2], env)
        if coll != "MODELSPACE":
            raise LispError("vlax-for: only ModelSpace mocked")
        frame = {var: None}
        e2 = (frame, env)
        for o in list(self.dwg.ms):
            if o.deleted:
                continue
            frame[var] = o
            for f in x[3:]:
                self.eval(f, e2)
        return None

    # -- builtins
    def _builtins(self):
        I = self

        def num(*a):
            for v in a:
                if not isinstance(v, (int, float)) or isinstance(v, bool):
                    raise LispError(f"bad argument type: numberp: {v!r}")

        def add(*a):
            num(*a); return sum(a) if a else 0

        def sub(*a):
            num(*a)
            if len(a) == 1:
                return -a[0]
            r = a[0]
            for v in a[1:]:
                r -= v
            return r

        def mul(*a):
            num(*a); r = 1
            for v in a:
                r *= v
            return r

        def div(*a):
            num(*a); r = a[0]
            for v in a[1:]:
                if v == 0:
                    raise LispError("divide by zero")
                r = r // v if isinstance(r, int) and isinstance(v, int) else r / v
            return r

        def L(x):
            return [] if x is None else x

        def car(x):
            if isinstance(x, Pair):
                return x.car
            if nil(x):
                return None
            if not isinstance(x, list):
                raise LispError(f"bad argument type: consp {x!r}")
            return x[0]

        def cdr(x):
            if isinstance(x, Pair):
                return x.cdr
            if nil(x):
                return None
            if not isinstance(x, list):
                raise LispError(f"bad argument type: consp {x!r}")
            return x[1:] or None

        def cons(a, b):
            if b is None or isinstance(b, list):
                return [a] + L(b)
            return Pair(a, b)

        def assoc(k, lst):
            for it in L(lst):
                if isinstance(it, Pair) and it.car == k:
                    return it
                if isinstance(it, list) and it and it[0] == k:
                    return it
            return None

        def subst(new, old, lst):
            return [new if it is old else it for it in L(lst)] or None

        def strcat(*a):
            for v in a:
                if not isinstance(v, str):
                    raise LispError(f"bad argument type: stringp {v!r}")
            return "".join(a)

        def itoa(n):
            if not isinstance(n, int):
                raise LispError(f"bad argument type: fixnump {n!r}")
            return str(n)

        def rtos(n, mode=2, prec=4):
            return f"{float(n):.{prec}f}"

        def princ(v=None):
            if v is not None:
                I.out.append(v if isinstance(v, str) else repr(v))
            return v

        def member(x, lst):
            l = L(lst)
            for i, v in enumerate(l):
                if v == x:
                    return l[i:]
            return None

        def wcmatch(s, pat):
            rx = "^" + re.escape(pat).replace(r"\*", ".*").replace(r"\?", ".") + "$"
            return lisp_bool(re.match(rx, s))

        def catch_apply(f, args):
            try:
                return I.apply(f if not isinstance(f, Sym) else I.lookup(f, None), L(args), f)
            except (ComError, LispError) as e:
                return ("CATCH-ALL-ERROR", str(e))

        def mapcar(f, *lists):
            f = I.lookup(f, None) if isinstance(f, Sym) else f
            return [I.apply(f, list(t)) for t in zip(*[L(l) for l in lists])] or None

        def getvar(name):
            return I.dwg.sysvars.get(name.upper())

        def getpoint(*a):
            I.out.append(a[-1] if a else "")
            return I.getpoint_answer

        def make_safearray(t, bounds):
            return SafeArray(bounds.cdr - bounds.car + 1)

        def fill(sa, lst):
            if len(L(lst)) != len(sa.items):
                raise LispError("vlax-safearray-fill: size mismatch")
            sa.items = list(L(lst))
            return sa

        def eq(a, b):
            return lisp_bool(a is b or (isinstance(a, (str, int, float)) and a == b))

        b = {
            "+": add, "-": sub, "*": mul, "/": div,
            "1+": lambda a: add(a, 1), "1-": lambda a: sub(a, 1),
            "=": lambda a, b_: lisp_bool(a == b_), "/=": lambda a, b_: lisp_bool(a != b_),
            "<": lambda a, b_: lisp_bool(a < b_), ">": lambda a, b_: lisp_bool(a > b_),
            "NOT": lambda a: lisp_bool(nil(a)), "NULL": lambda a: lisp_bool(nil(a)),
            "LIST": lambda *a: list(a) or None, "CONS": cons, "CAR": car, "CDR": cdr,
            "CADR": lambda x: car(cdr(x)), "CADDR": lambda x: car(cdr(cdr(x))),
            "CADDDR": lambda x: car(cdr(cdr(cdr(x)))),
            "LENGTH": lambda x: len(L(x)), "REVERSE": lambda x: list(reversed(L(x))) or None,
            "APPEND": lambda *a: sum((L(v) for v in a), []) or None,
            "ASSOC": assoc, "SUBST": subst, "MEMBER": member, "STRCAT": strcat, "ITOA": itoa,
            "RTOS": rtos, "STRCASE": lambda s: s.upper(), "WCMATCH": wcmatch,
            "PRINC": princ, "PROMPT": princ, "EQ": eq,
            "MAPCAR": mapcar, "GETVAR": getvar, "GETPOINT": getpoint,
            "VL-LOAD-COM": lambda: None,
            "VL-PRINC-TO-STRING": lambda v: v if isinstance(v, str) else repr(v),
            "VL-CATCH-ALL-APPLY": catch_apply,
            "VL-CATCH-ALL-ERROR-P": lambda x: lisp_bool(isinstance(x, tuple) and x[0] == "CATCH-ALL-ERROR"),
            "VLAX-GET-ACAD-OBJECT": lambda: "ACAD",
            "VLAX-3D-POINT": lambda p: Variant([float(v) for v in L(p)]),
            "VLAX-MAKE-SAFEARRAY": make_safearray, "VLAX-SAFEARRAY-FILL": fill,
            "VLAX-MAKE-VARIANT": lambda v: Variant(v),
        }
        return {Sym(k): v for k, v in b.items()}

    # -- ActiveX mock dispatch
    def _new(self, objname, **props):
        d = self.dwg
        if d.fail_after is not None and len([o for o in d.ms if o.props.get("_new")]) >= d.fail_after:
            raise ComError("injected failure (test)")
        props.setdefault("Layer", d.sysvars["CLAYER"])
        o = AcadObject(objname, _new=True, **props)
        d.ms.append(o)
        return o

    def vla(self, name, a):
        n = name[4:]
        d = self.dwg
        self.trace.append(n)
        if n == "GET-ACTIVEDOCUMENT":
            return "DOC"
        if n == "GET-MODELSPACE":
            return "MODELSPACE"
        if n == "GET-LAYERS":
            return "LAYERS"
        if n == "STARTUNDOMARK":
            d.undo.append("start"); return None
        if n == "ENDUNDOMARK":
            d.undo.append("end"); return None
        if n == "ITEM":
            assert a[0] == "LAYERS"
            key = a[1].upper()
            if key not in d.layers:
                raise ComError("Key not found")
            return d.layers[key]
        if n == "ADD" and a[0] == "LAYERS":
            o = AcadObject("AcDbLayerTableRecord", Name=a[1], LayerOn=VTRUE, Freeze=VFALSE,
                           Lock=VFALSE, Color=7, Lineweight=-3, Description="")
            d.layers[a[1].upper()] = o
            return o
        if a and a[0] == "MODELSPACE":
            if n == "ADDLIGHTWEIGHTPOLYLINE":
                arr = to_pt(a[1])
                if len(arr) % 2:
                    raise ComError("AddLightWeightPolyline: odd coordinate count")
                return self._new("AcDbPolyline", Coordinates=arr, Closed=VFALSE)
            if n == "ADDLINE":
                return self._new("AcDbLine", StartPoint=to_pt(a[1]), EndPoint=to_pt(a[2]))
            if n == "ADDARC":
                return self._new("AcDbArc", Center=to_pt(a[1]), Radius=float(a[2]),
                                 StartAngle=float(a[3]), EndAngle=float(a[4]))
            if n == "ADDTEXT":
                if not isinstance(a[1], str):
                    raise ComError("AddText: TextString must be a string")
                return self._new("AcDbText", TextString=a[1], InsertionPoint=to_pt(a[2]),
                                 Height=float(a[3]))
            if n == "ADDDIMROTATED":
                p1, p2, loc, ang = to_pt(a[1]), to_pt(a[2]), to_pt(a[3]), float(a[4])
                ux, uy = math.cos(ang), math.sin(ang)
                meas = abs((p2[0] - p1[0]) * ux + (p2[1] - p1[1]) * uy)
                return self._new("AcDbRotatedDimension", ExtLine1Point=p1, ExtLine2Point=p2,
                                 DimLinePoint=loc, Rotation=ang, Measurement=meas)
            raise LispError(f"mock: ModelSpace method not modelled: vla-{n}")
        if isinstance(a[0], AcadObject):
            o = a[0]
            if n == "DELETE":
                o.deleted = True
                d.ms.remove(o)
                return None
            if n.startswith("GET-"):
                return o.get(n[4:].title().replace("Objectname", "ObjectName")
                             if False else self._prop(o, n[4:]))
            if n.startswith("PUT-"):
                o.put(self._prop(o, n[4:]), a[1])
                return None
        raise LispError(f"mock: not modelled: vla-{n} {a!r}")

    PROPS = ["Layer", "Closed", "TextHeight", "ArrowheadSize", "Arrowhead1Type", "Arrowhead2Type",
             "ExtensionLineOffset", "ExtensionLineExtend", "TextGap", "PrimaryUnitsPrecision",
             "Color", "Lineweight", "Description", "LayerOn", "Freeze", "Lock", "ObjectName",
             "Measurement", "Handle", "Name"]

    def _prop(self, o, upper):
        for p in self.PROPS:
            if p.upper() == upper:
                return p
        raise ComError(f"unknown property {upper}")

    def run_file(self, path):
        src = open(path, encoding="utf-8").read()
        for form in parse(tokenize(src)):
            self.eval(form)

    def command(self, name):
        f = self.g.get(Sym("C:" + name.upper()))
        if not isinstance(f, Func):
            raise LispError(f"Unknown command {name}")
        start = len(self.out)
        self.out.append(f"\nCommand: {name}")
        try:
            self.apply(f, [], name)
        except (LispError, ComError) as e:
            handler = self.g.get(Sym("*ERROR*"))
            self.out.append(f"\n<error raised: {e}>")
            # AutoLISP calls the *error* that is visible in the failing scope
            if self._last_error_handler:
                self.apply(self._last_error_handler, [str(e)])
            elif isinstance(handler, Func):
                self.apply(handler, [str(e)])
        return "".join(self.out[start:])

    _last_error_handler = None

    def setq(self, s, v, env):  # noqa: F811  (track *error* for command())
        if s == "*ERROR*":
            self._last_error_handler = v
        e = env
        while e is not None:
            if s in e[0]:
                e[0][s] = v
                return
            e = e[1]
        self.g[s] = v


# ------------------------------------------------------------- scenarios --
def entities_json(dwg):
    res = []
    for o in dwg.ms:
        if not o.props.get("_new"):
            continue
        p = {k: v for k, v in o.props.items() if k != "_new"}
        p["ObjectName"] = o.ObjectName
        p["Handle"] = o.Handle
        res.append(p)
    return res


def main(lsp, outdir):
    import os
    os.makedirs(outdir, exist_ok=True)
    report = {}

    # S1: blank drawing, Enter at base point prompt -> origin
    d1 = Drawing()
    i1 = Interp(d1)
    i1.run_file(lsp)
    load_msg = "".join(i1.out)
    log1 = "Command: (load \"CAD001_ROOM.lsp\")" + load_msg + i1.command("CAD001_ROOM") + i1.command("CAD001_CHECK")
    ents = entities_json(d1)
    report["S1_blank_dwg"] = {"log": log1, "entity_count": len(ents),
                              "undo_marks": d1.undo,
                              "layers": {k: {kk: vv for kk, vv in v.props.items()}
                                         for k, v in d1.layers.items()}}
    json.dump(ents, open(f"{outdir}/sim_entities.json", "w"), indent=1)

    # S2: drawing with 5 pre-existing objects and a pre-existing A-WALL (red)
    d2 = Drawing(preexisting_layers={"A-WALL": {"Color": 1}}, preexisting_entities=5)
    before = [(o.Handle, json.dumps(o.props, sort_keys=True)) for o in d2.ms]
    i2 = Interp(d2, getpoint_answer=[10000.0, 0.0, 0.0])
    i2.run_file(lsp)
    log2 = i2.command("CAD001_ROOM")
    after = [(o.Handle, json.dumps(o.props, sort_keys=True)) for o in d2.ms if not o.props.get("_new")]
    report["S2_existing_objects"] = {"log": log2, "preexisting_unchanged": before == after,
                                     "awall_color_after": d2.layers["A-WALL"].props["Color"],
                                     "new_entities": len(entities_json(d2))}

    # S3: A-DOOR exists and is LOCKED -> must stop, draw nothing, create no layer
    d3 = Drawing(preexisting_layers={"A-DOOR": {"Lock": VTRUE}})
    i3 = Interp(d3)
    i3.run_file(lsp)
    log3 = i3.command("CAD001_ROOM")
    report["S3_locked_layer"] = {"log": log3, "new_entities": len(entities_json(d3)),
                                 "layers": sorted(d3.layers)}

    # S4: UCS not world -> stop
    d4 = Drawing(); d4.sysvars["WORLDUCS"] = 0
    i4 = Interp(d4); i4.run_file(lsp)
    report["S4_ucs_not_world"] = {"log": i4.command("CAD001_ROOM"),
                                  "new_entities": len(entities_json(d4))}

    # S5: failure injected after 7 objects -> rollback removes only new ones
    d5 = Drawing(preexisting_entities=3); d5.fail_after = 7
    i5 = Interp(d5); i5.run_file(lsp)
    report["S5_error_rollback"] = {"log": i5.command("CAD001_ROOM"),
                                   "new_entities_left": len(entities_json(d5)),
                                   "preexisting_left": len([o for o in d5.ms if not o.props.get("_new")]),
                                   "undo_marks": d5.undo}

    # S6: read-only environment report
    d6 = Drawing(); i6 = Interp(d6); i6.run_file(lsp)
    report["S6_env_readonly"] = {"log": i6.command("CAD001_ENV"),
                                 "new_entities": len(entities_json(d6)),
                                 "layers": sorted(d6.layers)}

    json.dump(report, open(f"{outdir}/sim_report.json", "w"), indent=1, ensure_ascii=False)
    return report, ents


if __name__ == "__main__":
    rep, ents = main(sys.argv[1], sys.argv[2])
    for k, v in rep.items():
        print("=" * 70, "\n", k)
        print(v["log"])
        print({kk: vv for kk, vv in v.items() if kk not in ("log", "layers")})
