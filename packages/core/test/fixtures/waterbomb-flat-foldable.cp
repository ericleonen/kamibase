# The waterbomb base's eight creases with the lower half of the vertical book
# fold reversed to valley.
#
# Hand-written companion to waterbomb.cp. The centre now carries five valleys
# and three mountains, so |M - V| = 2 and Maekawa passes; the eight sectors are
# 45 degrees each, so Kawasaki passes too. This is the fixture that exercises
# the L3 path at a high-degree vertex, where waterbomb.cp exercises the
# Maekawa failure.
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

# horizontal book fold
2 0 0.5 1 0.5

# vertical book fold, split at the centre: upper half mountain, lower valley
2 0.5 0.5 0.5 1
3 0.5 0 0.5 0.5
