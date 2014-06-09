# voxel-decals

Adds textured planes on the side of blocks (voxel.js plugin)

![screenshot](http://i.imgur.com/cTsVmaB.png "Screenshot decal")

Example above is from [voxel-mine](https://github.com/deathcap/voxel-mine), using
a transparent texture decal for block break progress.

Requires
[voxel-mesher](https://github.com/deathcap/voxel-mesher),
[voxel-stitch](https://github.com/deathcap/voxel-shader),
[voxel-stitch](https://github.com/deathcap/voxel-stitch).

## API

* `add({position: [x,y,z], normal: [x,y,z], texture: name})`: adds a new decal at the given
voxel position, on the face specified by the normal. All sides are supported:

![screenshot](http://i.imgur.com/df3jP1P.png "Screenshot sides")

The texture name should be loaded into [voxel-stitch](https://github.com/deathcap/voxel-stitch),
using `preloadTexture()` if needed.

* `change({position: [x,y,z], normal: [x,y,z], texture: texture})`: same as add() but calls remove() first

* `remove([x,y,z])`: removes the decal at the given location

## License

MIT

