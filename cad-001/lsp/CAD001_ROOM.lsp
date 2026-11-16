;;; ==========================================================================
;;; CAD001_ROOM.lsp  --  CAD-001 AutoCAD automation proof of concept  V1.0
;;; --------------------------------------------------------------------------
;;; Commands
;;;   CAD001_ROOM   Draw a 4000 x 6000 mm room (wall / door / window / dims)
;;;   CAD001_CHECK  List objects on the CAD001 layers + every dimension value
;;;   CAD001_ENV    Read-only report: AutoCAD version, LISPSYS, SECURELOAD ...
;;;
;;; Requires : AutoCAD (full version, Windows) with Visual LISP / ActiveX.
;;;            Not for AutoCAD LT before 2024, not for AutoCAD for Mac
;;;            (vla-* functions are Windows-only).
;;; Encoding : messages are ASCII on purpose, so the file loads the same
;;;            whether LISPSYS is 0 (ANSI) or 1/2 (Unicode).
;;;
;;; ---------------------------- DESIGN BASIS -------------------------------
;;; All values in mm, drawing units must be millimetres (INSUNITS = 4).
;;; Origin (0,0) = INSIDE face of the south-west corner, i.e. the base point
;;; you pick when the command asks for it (Enter = 0,0).
;;;
;;;  Room       4000 (X, east-west) x 6000 (Y, north-south) = CLEAR INTERIOR
;;;             dimension, wall face to wall face.
;;;  Wall       150 thick, built OUTWARD from the interior faces.
;;;             Exterior outline = 4300 x 6300, from (-150,-150) to (4150,6150).
;;;  Door  D1   South wall. Clear opening 900 (jamb to jamb),
;;;             X = 300 .. 1200 measured from the inside face of the west wall.
;;;             Single leaf, hinge at the WEST jamb (x = 300), swings INTO the
;;;             room (leaf shown open 90 deg, 40 thick), 900 swing arc.
;;;             Plan symbol: leaf width = opening width (no frame deduction).
;;;  Window W1  East wall. Opening 1500, centred on the wall:
;;;             Y = 2250 .. 3750 from the inside face of the south wall.
;;;             Plan symbol: 2 frame lines on the wall faces + 2 glass lines.
;;;             Opening type, sill and head height are NOT drawn in plan and
;;;             are NOT part of this test (only the tag text says "1500").
;;;  Dimensions (all rotated/linear, measured on the wall faces):
;;;    south  : 300 | 900 | 2800  (door chain, interior face)   + 4000 clear
;;;    east   : 2250 | 1500 | 2250 (window chain, interior face) + 6000 clear
;;;    north  : 150 | 4000 | 150   + 4300 overall
;;;    west   : 150 | 6000 | 150   + 6300 overall
;;;
;;; ---------------------------- SAFETY RULES -------------------------------
;;;  * Only ADDS objects to Model Space. It never selects, edits, moves or
;;;    deletes any object that existed before the command ran.
;;;  * Existing layers with the same names are reused as-is (their colour,
;;;    linetype etc. are not changed). If such a layer is OFF, FROZEN or
;;;    LOCKED the command stops before drawing anything.
;;;  * Does not change CLAYER, OSMODE, dimension style or any system variable.
;;;  * All objects are wrapped in one UNDO group: a single U removes them.
;;;  * If an error happens part-way, the objects created by THIS run are
;;;    deleted again (rollback) - nothing else is touched.
;;; ==========================================================================

(vl-load-com)

;;; ----------------------------- parameters --------------------------------
(setq *cad001-version* "1.0")
(setq *cad001-room-x*  4000.0)    ; clear interior width  (X)
(setq *cad001-room-y*  6000.0)    ; clear interior depth  (Y)
(setq *cad001-wall*     150.0)    ; wall thickness
(setq *cad001-door-x0*  300.0)    ; door west jamb, from inside face west wall
(setq *cad001-door-w*   900.0)    ; door clear opening
(setq *cad001-leaf-t*    40.0)    ; door leaf thickness (symbol)
(setq *cad001-win-w*   1500.0)    ; window opening
(setq *cad001-win-y0*  (/ (- *cad001-room-y* *cad001-win-w*) 2.0)) ; 2250
(setq *cad001-glass-gap* 20.0)    ; distance between the 2 glass lines
(setq *cad001-dim-off1* 600.0)    ; 1st dim row distance from exterior face
(setq *cad001-dim-off2* 1200.0)   ; 2nd dim row
(setq *cad001-txt-h*    125.0)    ; dim / tag text height (2.5 mm @ 1:50)

;;; layer name, ACI colour, lineweight (1/100 mm), description
(setq *cad001-layers*
  (list
    (list "A-WALL"      7 50 "CAD001 walls")
    (list "A-DOOR"      3 25 "CAD001 doors")
    (list "A-GLAZ"      4 25 "CAD001 windows")
    (list "A-ANNO-DIMS" 2 18 "CAD001 dimensions")
  )
)

;;; ----------------------------- helpers -----------------------------------
(setq *cad001-made* nil)          ; objects created by the current run

(defun cad001:keep (obj)
  (setq *cad001-made* (cons obj *cad001-made*))
  obj
)

(defun cad001:xy (base p)
  (list (+ (car base) (car p)) (+ (cadr base) (cadr p)) 0.0)
)

(defun cad001:3d (base p)
  (vlax-3d-point (cad001:xy base p))
)

;;; list of (x y) -> variant of doubles for AddLightWeightPolyline
(defun cad001:2d-array (base pts / flat sa)
  (foreach p pts
    (setq flat (append flat (list (+ (car base) (car p)) (+ (cadr base) (cadr p)))))
  )
  (setq sa (vlax-make-safearray vlax-vbDouble (cons 0 (1- (length flat)))))
  (vlax-safearray-fill sa flat)
  (vlax-make-variant sa)
)

(defun cad001:pline (ms base pts layer / o)
  (setq o (cad001:keep (vla-AddLightWeightPolyline ms (cad001:2d-array base pts))))
  (vla-put-Closed o :vlax-true)
  (vla-put-Layer o layer)
  o
)

(defun cad001:line (ms base p1 p2 layer / o)
  (setq o (cad001:keep (vla-AddLine ms (cad001:3d base p1) (cad001:3d base p2))))
  (vla-put-Layer o layer)
  o
)

(defun cad001:arc (ms base cen r a1 a2 layer / o)
  (setq o (cad001:keep (vla-AddArc ms (cad001:3d base cen) r a1 a2)))
  (vla-put-Layer o layer)
  o
)

(defun cad001:text (ms base str p layer / o)
  (setq o (cad001:keep (vla-AddText ms str (cad001:3d base p) *cad001-txt-h*)))
  (vla-put-Layer o layer)
  o
)

;;; linear dimension. ang = 0 horizontal, (/ pi 2) vertical
(defun cad001:dim (ms base p1 p2 loc ang / o)
  (setq o (cad001:keep
            (vla-AddDimRotated ms (cad001:3d base p1) (cad001:3d base p2)
                                  (cad001:3d base loc) ang)))
  (vla-put-Layer o "A-ANNO-DIMS")
  ;; per-object overrides only - the drawing's dimension style is untouched
  (vla-put-TextHeight o *cad001-txt-h*)
  (vla-put-ArrowheadSize o 75.0)
  (vla-put-Arrowhead1Type o acArrowArchTick)
  (vla-put-Arrowhead2Type o acArrowArchTick)
  (vla-put-ExtensionLineOffset o 75.0)
  (vla-put-ExtensionLineExtend o 75.0)
  (vla-put-TextGap o 40.0)
  (vla-put-PrimaryUnitsPrecision o acDimPrecisionZero)
  o
)

;;; chain of dims through a list of points, all at the same dim-line position
(defun cad001:chain (ms base pts loc-fn ang / p1)
  (setq p1 (car pts))
  (foreach p2 (cdr pts)
    (cad001:dim ms base p1 p2 (loc-fn p1 p2) ang)
    (setq p1 p2)
  )
)

;;; check layers BEFORE drawing. returns list of problem strings (nil = ok)
(defun cad001:layer-problems (doc / lays res lay nm)
  (setq lays (vla-get-Layers doc))
  (foreach def *cad001-layers*
    (setq nm (car def))
    (setq lay (vl-catch-all-apply 'vla-Item (list lays nm)))
    (if (not (vl-catch-all-error-p lay))
      (progn
        (if (= (vla-get-LayerOn lay) :vlax-false)
          (setq res (cons (strcat nm " is OFF") res)))
        (if (= (vla-get-Freeze lay) :vlax-true)
          (setq res (cons (strcat nm " is FROZEN") res)))
        (if (= (vla-get-Lock lay) :vlax-true)
          (setq res (cons (strcat nm " is LOCKED") res)))
      )
    )
  )
  (reverse res)
)

;;; create missing layers. returns list of (name "created"/"existing")
(defun cad001:ensure-layers (doc / lays res lay nm)
  (setq lays (vla-get-Layers doc))
  (foreach def *cad001-layers*
    (setq nm (car def))
    (setq lay (vl-catch-all-apply 'vla-Item (list lays nm)))
    (if (vl-catch-all-error-p lay)
      (progn
        (setq lay (vla-Add lays nm))
        (vla-put-Color lay (cadr def))
        (vla-put-Lineweight lay (caddr def))
        (vla-put-Description lay (cadddr def))
        (setq res (cons (list nm "created") res))
      )
      (setq res (cons (list nm "existing - reused, not modified") res))
    )
  )
  (reverse res)
)

(defun cad001:rollback ( / n)
  (setq n 0)
  (foreach o *cad001-made*
    (if (not (vl-catch-all-error-p (vl-catch-all-apply 'vla-Delete (list o))))
      (setq n (1+ n)))
  )
  (setq *cad001-made* nil)
  n
)

;;; ----------------------------- geometry ----------------------------------
(defun cad001:draw (ms base / rx ry w dx0 dx1 wy0 wy1 gx1 gx2 o1 o2)
  (setq rx  *cad001-room-x*
        ry  *cad001-room-y*
        w   *cad001-wall*
        dx0 *cad001-door-x0*
        dx1 (+ *cad001-door-x0* *cad001-door-w*)
        wy0 *cad001-win-y0*
        wy1 (+ *cad001-win-y0* *cad001-win-w*)
  )

  ;; --- walls: the wall ring is cut by the door and the window, which
  ;; leaves exactly two closed wall outlines (hatchable, editable plines).
  ;; Piece 1: door east jamb -> south wall -> east wall up to window sill
  (cad001:pline ms base
    (list (list dx1 (- w)) (list (+ rx w) (- w)) (list (+ rx w) wy0)
          (list rx wy0) (list rx 0.0) (list dx1 0.0))
    "A-WALL")
  ;; Piece 2: window head -> east, north, west walls -> door west jamb
  (cad001:pline ms base
    (list (list (+ rx w) wy1) (list (+ rx w) (+ ry w)) (list (- w) (+ ry w))
          (list (- w) (- w)) (list dx0 (- w)) (list dx0 0.0)
          (list 0.0 0.0) (list 0.0 ry) (list rx ry) (list rx wy1))
    "A-WALL")

  ;; --- door D1: leaf open 90 deg inside the room + swing arc
  (cad001:pline ms base
    (list (list dx0 0.0) (list (+ dx0 *cad001-leaf-t*) 0.0)
          (list (+ dx0 *cad001-leaf-t*) *cad001-door-w*) (list dx0 *cad001-door-w*))
    "A-DOOR")
  ;; arc centre = hinge, from closed position (east jamb) to open leaf tip
  (cad001:arc ms base (list dx0 0.0) *cad001-door-w* 0.0 (/ pi 2.0) "A-DOOR")
  (cad001:text ms base "D1 900"
    (list (+ dx0 250.0) (+ *cad001-door-w* 150.0)) "A-DOOR")

  ;; --- window W1: frame lines on both wall faces + 2 glass lines
  (setq gx1 (- (+ rx (/ w 2.0)) (/ *cad001-glass-gap* 2.0))
        gx2 (+ (+ rx (/ w 2.0)) (/ *cad001-glass-gap* 2.0)))
  (cad001:line ms base (list rx wy0)       (list rx wy1)       "A-GLAZ")
  (cad001:line ms base (list (+ rx w) wy0) (list (+ rx w) wy1) "A-GLAZ")
  (cad001:line ms base (list gx1 wy0)      (list gx1 wy1)      "A-GLAZ")
  (cad001:line ms base (list gx2 wy0)      (list gx2 wy1)      "A-GLAZ")
  (cad001:text ms base "W1 1500"
    (list (- rx 900.0) (+ wy0 (/ *cad001-win-w* 2.0))) "A-GLAZ")

  ;; --- dimensions
  (setq o1 *cad001-dim-off1* o2 *cad001-dim-off2*)
  ;; south: door chain on interior face, then clear width
  (cad001:chain ms base
    (list (list 0.0 0.0) (list dx0 0.0) (list dx1 0.0) (list rx 0.0))
    (function (lambda (a b) (list (/ (+ (car a) (car b)) 2.0) (- (- w) o1))))
    0.0)
  (cad001:dim ms base (list 0.0 0.0) (list rx 0.0)
    (list (/ rx 2.0) (- (- w) o2)) 0.0)
  ;; east: window chain on interior face, then clear depth
  (cad001:chain ms base
    (list (list rx 0.0) (list rx wy0) (list rx wy1) (list rx ry))
    (function (lambda (a b) (list (+ rx w o1) (/ (+ (cadr a) (cadr b)) 2.0))))
    (/ pi 2.0))
  (cad001:dim ms base (list rx 0.0) (list rx ry)
    (list (+ rx w o2) (/ ry 2.0)) (/ pi 2.0))
  ;; north: wall | clear | wall, then overall
  (cad001:chain ms base
    (list (list (- w) (+ ry w)) (list 0.0 (+ ry w)) (list rx (+ ry w))
          (list (+ rx w) (+ ry w)))
    (function (lambda (a b) (list (/ (+ (car a) (car b)) 2.0) (+ ry w o1))))
    0.0)
  (cad001:dim ms base (list (- w) (+ ry w)) (list (+ rx w) (+ ry w))
    (list (/ rx 2.0) (+ ry w o2)) 0.0)
  ;; west: wall | clear | wall, then overall
  (cad001:chain ms base
    (list (list (- w) (- w)) (list (- w) 0.0) (list (- w) ry) (list (- w) (+ ry w)))
    (function (lambda (a b) (list (- (- w) o1) (/ (+ (cadr a) (cadr b)) 2.0))))
    (/ pi 2.0))
  (cad001:dim ms base (list (- w) (- w)) (list (- w) (+ ry w))
    (list (- (- w) o2) (/ ry 2.0)) (/ pi 2.0))
)

;;; ----------------------------- commands ----------------------------------
(defun c:CAD001_ROOM ( / *error* acad doc ms probs lays base pt n)
  (defun *error* (msg / k)
    (if (and msg (not (member msg '("Function cancelled" "quit / exit abort"))))
      (princ (strcat "\n[CAD001] ERROR: " msg)))
    (setq k (cad001:rollback))
    (if (> k 0) (princ (strcat "\n[CAD001] rollback: " (itoa k) " new object(s) removed.")))
    (if doc (vla-EndUndoMark doc))
    (princ)
  )
  (setq acad (vlax-get-acad-object)
        doc  (vla-get-ActiveDocument acad)
        ms   (vla-get-ModelSpace doc)
        *cad001-made* nil)
  (princ (strcat "\n[CAD001] CAD001_ROOM v" *cad001-version*))

  ;; pre-flight checks - nothing is created if one fails
  (cond
    ((= (getvar "WORLDUCS") 0)
      (princ "\n[CAD001] STOP: current UCS is not World. Run UCS > W and retry."))
    ((setq probs (cad001:layer-problems doc))
      (princ "\n[CAD001] STOP: existing layer(s) not usable, nothing drawn:")
      (foreach p probs (princ (strcat "\n           - " p))))
    (t
      (if (/= (getvar "INSUNITS") 4)
        (princ (strcat "\n[CAD001] WARNING: INSUNITS = " (itoa (getvar "INSUNITS"))
                       " (4 = mm expected). Geometry is drawn in mm values anyway.")))
      (setq pt (getpoint "\n[CAD001] Base point = inside SW corner <0,0>: "))
      (setq base (if pt pt (list 0.0 0.0 0.0)))
      (vla-StartUndoMark doc)
      (setq lays (cad001:ensure-layers doc))
      (foreach l lays (princ (strcat "\n[CAD001] layer " (car l) ": " (cadr l))))
      (cad001:draw ms base)
      (setq n (length *cad001-made*))
      (vla-EndUndoMark doc)
      (setq *cad001-made* nil)
      (princ (strcat "\n[CAD001] done: " (itoa n) " objects added "
                     "(2 wall plines, 1 door leaf, 1 arc, 4 window lines, 2 texts, 16 dims)."))
      (princ "\n[CAD001] Run CAD001_CHECK to list them, U to undo the whole run.")
    )
  )
  (princ)
)

(defun c:CAD001_CHECK ( / doc ms names cnt key hit dims d)
  (setq doc (vla-get-ActiveDocument (vlax-get-acad-object))
        ms  (vla-get-ModelSpace doc)
        names (mapcar 'car *cad001-layers*))
  (vlax-for o ms
    (if (member (strcase (vla-get-Layer o)) names)
      (progn
        (setq key (strcat (vla-get-Layer o) " / " (vla-get-ObjectName o)))
        (if (setq hit (assoc key cnt))
          (setq cnt (subst (cons key (1+ (cdr hit))) hit cnt))
          (setq cnt (cons (cons key 1) cnt)))
        (if (wcmatch (vla-get-ObjectName o) "AcDb*Dimension")
          (setq dims (cons (vla-get-Measurement o) dims)))
      )
    )
  )
  (princ "\n[CAD001] ===== CAD001_CHECK =====")
  (foreach c (reverse cnt)
    (princ (strcat "\n  " (car c) " : " (itoa (cdr c)))))
  (princ (strcat "\n  dimensions found: " (itoa (length dims))))
  (princ "\n  values:")
  (foreach d (reverse dims) (princ (strcat " " (rtos d 2 0))))
  (princ "\n[CAD001] expected per room: A-WALL 2 plines, A-DOOR 1 pline + 1 arc + 1 text,")
  (princ "\n          A-GLAZ 4 lines + 1 text, A-ANNO-DIMS 16 rotated dims.")
  (princ)
)

;;; read-only environment report for phase-1 reconnaissance (changes nothing)
(defun c:CAD001_ENV ( / v)
  (princ "\n[CAD001] ===== CAD001_ENV (read-only) =====")
  (foreach n '("ACADVER" "_VERNUM" "PRODUCT" "PLATFORM" "LISPSYS" "SECURELOAD"
               "TRUSTEDPATHS" "INSUNITS" "MEASUREMENT" "DWGNAME" "DWGPREFIX")
    (setq v (getvar n))
    (princ (strcat "\n  " n " = " (if v (vl-princ-to-string v) "<not available>")))
  )
  (princ (strcat "\n  ActiveX (vla) available = "
                 (if (vl-catch-all-error-p (vl-catch-all-apply 'vlax-get-acad-object nil))
                   "NO" "YES")))
  (princ)
)

(princ "\n[CAD001] CAD001_ROOM.lsp v1.0 loaded. Commands: CAD001_ROOM, CAD001_CHECK, CAD001_ENV")
(princ)
