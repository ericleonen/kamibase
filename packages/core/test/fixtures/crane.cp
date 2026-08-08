# Traditional crane: the bird base crease pattern, on the unit square.
#
# Hand-written. This is the bird base the crane is folded from: the two
# diagonals, the two book folds, and the eight 22.5 degree petal-fold creases
# that run from each corner to the point (1 +- (sqrt(2)-1)) / 2 on a book fold.
# The head, tail and wing shaping creases are NOT included. They are made
# after the base and do not change the base's crease pattern.
#
# 0.207106781 = (sqrt(2) - 1) / 2 = 0.5 * tan(22.5 deg)
#
# The assignment is not 4-fold symmetric, and cannot be: Maekawa forbids a
# degree-8 vertex with four mountains and four valleys, so one of the eight
# creases at the centre has to run the other way. The crane is not a symmetric
# model either: it has a head at one end and a tail at the other.
#
# Format: <type> <x1> <y1> <x2> <y2>   1 = border, 2 = mountain, 3 = valley

# paper edge
1 0 0 1 0
1 1 0 1 1
1 1 1 0 1
1 0 1 0 0

# diagonals, as four rays from the centre
2 0.5 0.5 1 1
2 0.5 0.5 0 1
2 0.5 0.5 1 0
3 0.5 0.5 0 0

# book folds, outer halves
2 0.5 0 0.5 0.207106781
2 0.5 1 0.5 0.792893219
2 0 0.5 0.207106781 0.5
2 1 0.5 0.792893219 0.5

# book folds, inner halves
3 0.5 0.207106781 0.5 0.5
3 0.5 0.792893219 0.5 0.5
3 0.207106781 0.5 0.5 0.5
3 0.792893219 0.5 0.5 0.5

# petal-fold creases, two from each corner at 22.5 degrees
2 0 0 0.5 0.207106781
2 0 0 0.207106781 0.5
2 1 0 0.5 0.207106781
2 1 0 0.792893219 0.5
2 1 1 0.5 0.792893219
2 1 1 0.792893219 0.5
2 0 1 0.5 0.792893219
2 0 1 0.207106781 0.5
