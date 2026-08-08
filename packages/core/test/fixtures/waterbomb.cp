# Waterbomb base: the eight-crease precrease pattern as it is normally drawn,
# both diagonals valley, both book folds mountain, on the unit square.
#
# Hand-written, and deliberately written as full lines rather than rays: the
# parser has to split all four at the centre, and the two book folds also make
# T-junctions with the paper edge at the four edge midpoints. That is what
# makes this a planarization fixture as well as a validation one.
#
# Note that as drawn this is L1 (structurally clean) but not L3: the centre is
# a degree-8 vertex with four mountains and four valleys, and Maekawa requires
# |M - V| = 2. See waterbomb-flat-foldable.cp for the same eight creases with
# one half-crease reversed, which does satisfy it.
#
# Format: <type> <x1> <y1> <x2> <y2>   1 = border, 2 = mountain, 3 = valley

# paper edge
1 0 0 1 0
1 1 0 1 1
1 1 1 0 1
1 0 1 0 0

# diagonals
3 0 0 1 1
3 1 0 0 1

# book folds
2 0.5 0 0.5 1
2 0 0.5 1 0.5
