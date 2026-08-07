# Miura-ori — 4 columns x 3 bands on a unit square.
#
# Hand-written. Straight vertical creases at x = 0.25, 0.5, 0.75; two zigzag
# horizontal creases whose vertices sit 0.08 higher on odd columns.
#
# The assignment follows the rule that makes a Miura fold: each zigzag line is
# one type along its whole length, and every vertical crease switches type
# where it crosses a zigzag. That gives 3-to-1 at each of the six interior
# vertices, which is what Maekawa requires; the zigzag's mirror symmetry about
# the vertical gives Kawasaki exactly.
#
# Format: <type> <x1> <y1> <x2> <y2>   1 = border, 2 = mountain, 3 = valley

# paper edge
1 0 0 1 0
1 1 0 1 1
1 1 1 0 1
1 0 1 0 0

# lower zigzag (mountain)
2 0 0.3 0.25 0.38
2 0.25 0.38 0.5 0.3
2 0.5 0.3 0.75 0.38
2 0.75 0.38 1 0.3

# upper zigzag (valley)
3 0 0.6 0.25 0.68
3 0.25 0.68 0.5 0.6
3 0.5 0.6 0.75 0.68
3 0.75 0.68 1 0.6

# vertical creases, band by band: M below the lower zigzag, V between the
# zigzags, M above the upper one
2 0.25 0 0.25 0.38
3 0.25 0.38 0.25 0.68
2 0.25 0.68 0.25 1

2 0.5 0 0.5 0.3
3 0.5 0.3 0.5 0.6
2 0.5 0.6 0.5 1

2 0.75 0 0.75 0.38
3 0.75 0.38 0.75 0.68
2 0.75 0.68 0.75 1
