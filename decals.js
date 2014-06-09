'use strict';

var createBuffer = require('gl-buffer');
var createVAO = require('gl-vao');
var glslify = require('glslify');
var glm = require('gl-matrix');
var mat4 = glm.mat4;

module.exports = function(game, opts) {
  return new DecalsPlugin(game, opts);
};
module.exports.pluginInfo = {
  loadAfter: ['voxel-mesher', 'voxel-shader', 'voxel-stitch']
};

function DecalsPlugin(game, opts) {
  this.game = game;
  this.shell = game.shell;

  this.mesherPlugin = game.plugins.get('voxel-mesher');
  if (!this.mesherPlugin) throw new Error('voxel-decals requires voxel-mesher');

  this.shaderPlugin = game.plugins.get('voxel-shader');
  if (!this.shaderPlugin) throw new Error('voxel-decals requires voxel-shader');

  this.stitchPlugin = game.plugins.get('voxel-stitch');
  if (!this.stitchPlugin) throw new Error('voxel-stitch requires voxel-shader');

  this.info = []
  /* for testing
  [
    {position:[0,0,0], normal:[-1,0,0], texture:'furnace_top'},
    {position:[0,1,0], normal:[+1,0,0], texture:'furnace_top'},
    {position:[0,2,0], normal:[0,+1,0], texture:'furnace_top'},
    {position:[0,3,0], normal:[0,-1,0], texture:'furnace_top'},
    {position:[0,4,0], normal:[0,0,+1], texture:'furnace_front_on'},
    {position:[0,5,0], normal:[0,0,-1], texture:'furnace_top'},
  ];
  */

  this.enable();
}

DecalsPlugin.prototype.add = function(info) {
  this.info.push(info);
};

DecalsPlugin.prototype.remove = function(position) {
  var found = undefined;
  for (var i = 0; i < this.info.length; i += 1) { // TODO: optimize to a map if this is too inefficient
    if (this.info[i].position[0] === position[0] &&
        this.info[i].position[1] === position[1] &&
        this.info[i].position[2] === position[2]) {
      found = i;
      break;
    }
  }
  if (found === undefined) return;

  this.info.splice(found, 1);
};

DecalsPlugin.prototype.change = function(info) {
  this.remove(info.position);
  this.add(info); // TODO: optimize to change without removing if necessary
};

DecalsPlugin.prototype.enable = function() {
  this.shell.on('gl-init', this.onInit = this.shaderInit.bind(this));
  this.shell.on('gl-render', this.onRender = this.render.bind(this));
  this.stitchPlugin.on('updateTexture', this.onUpdateTexture = this.update.bind(this));
};

DecalsPlugin.prototype.disable = function() {
  this.stitchPlugin.removeListener('updateTexture', this.onUpdateTexture);
  this.shell.removeListener('gl-render', this.onRender = this.render.bind(this));
  this.shell.removeListener('gl-init', this.onInit);
};

DecalsPlugin.prototype.shaderInit = function() {
  // TODO: refactor with voxel-decals, voxel-chunkborder?
  this.shader = glslify({
    inline: true,
    vertex: "/* voxel-decals vertex shader */\
attribute vec3 position;\
attribute vec2 uv;\
\
uniform mat4 projection;\
uniform mat4 view;\
uniform mat4 model;\
varying vec2 vUv;\
\
void main() {\
  gl_Position = projection * view * model * vec4(position, 1.0);\
  vUv = uv;\
}",

  fragment: "/* voxel-decals fragment shader */\
precision highp float;\
\
uniform sampler2D texture;\
varying vec2 vUv;\
\
void main() {\
  gl_FragColor = texture2D(texture, vUv);\
}"})(this.shell.gl);
};

DecalsPlugin.prototype.update = function() {
  // cube face vertices, indexed by normal (based on box-geometry)
  var cube = {
    // Back face
    '0|0|1': [
    0, 0, 1,
    1, 0, 1,
    1, 1, 1,

    0, 0, 1,
    1, 1, 1,
    0, 1, 1],

    // Front face
    '0|0|-1': [
    0, 0, 0,
    0, 1, 0,
    1, 1, 0,

    0, 0, 0,
    1, 1, 0,
    1, 0, 0],

    // Top face
    '0|1|0': [
    0, 1, 0,
    0, 1, 1,
    1, 1, 1,

    0, 1, 0,
    1, 1, 1,
    1, 1, 0],

    // Bottom face
    '0|-1|0': [
    0, 0, 0,
    1, 0, 0,
    1, 0, 1,

    0, 0, 0,
    1, 0, 1,
    0, 0, 1],

    // Left face
    '1|0|0': [
    1, 0, 0,
    1, 1, 0,
    1, 1, 1,

    1, 0, 0,
    1, 1, 1,
    1, 0, 1],

    // Right face
    '-1|0|0': [
    0, 0, 0,
    0, 0, 1,
    0, 1, 1,

    0, 0, 0,
    0, 1, 1,
    0, 1, 0],
  };

  var vertices = [];
  var uvArray = [];

  for (var i = 0; i < this.info.length; i += 1) {
    // start with plane corresponding to desired cube face
    var normal = this.info[i].normal;
    var plane = cube[normal.join('|')].slice(0);

    // translate into position
    for (var j = 0; j < plane.length; j += 1) {
      plane[j] += this.info[i].position[j % 3];

      // and raise out of surface by a small amount to prevent z-fighting
      plane[j] += normal[j % 3] * 0.001;
    }

    vertices = vertices.concat(plane);

    // texturing (textures loaded from voxel-stitch updateTexture event)
    var tileUV = this.stitchPlugin.getTextureUV(this.info[i].texture);
    if (!tileUV) throw new Error('failed to load decal texture: ' + this.info[i].texture + ' for ' + this.info[i]);

    // cover the texture tile over the two triangles forming a flat plane
    var planeUV = [
      tileUV[3],
      tileUV[0],
      tileUV[1],

      tileUV[2],
    ];

    // rotate UVs so texture is always facing up
    var r = 0;
    if (normal[0] === -1 || 
        normal[1] === -1 ||
        normal[2] === 1) { // TODO: -1?
      r = 3;
    }

    uvArray.push(planeUV[(0 + r) % 4][0]); uvArray.push(planeUV[(0 + r) % 4][1]);
    uvArray.push(planeUV[(1 + r) % 4][0]); uvArray.push(planeUV[(1 + r) % 4][1]);
    uvArray.push(planeUV[(2 + r) % 4][0]); uvArray.push(planeUV[(2 + r) % 4][1]);

    uvArray.push(planeUV[(0 + r) % 4][0]); uvArray.push(planeUV[(0 + r) % 4][1]);
    uvArray.push(planeUV[(2 + r) % 4][0]); uvArray.push(planeUV[(2 + r) % 4][1]);
    uvArray.push(planeUV[(3 + r) % 4][0]); uvArray.push(planeUV[(3 + r) % 4][1]);
  }

  var uv = new Float32Array(uvArray);

  var gl = this.shell.gl;

  var verticesBuf = createBuffer(gl, new Float32Array(vertices));
  var uvBuf = createBuffer(gl, uv);

  this.mesh = createVAO(gl, [
      { buffer: verticesBuf,
        size: 3
      },
      {
        buffer: uvBuf,
        size: 2
      }
      ]);
  this.mesh.length = vertices.length/3;
};

var scratch0 = mat4.create();

DecalsPlugin.prototype.render = function() {
  if (this.mesh) {
    var gl = this.shell.gl;

    this.shader.bind();
    this.shader.attributes.position.location = 0;
    this.shader.attributes.uv.location = 1;
    this.shader.uniforms.projection = this.shaderPlugin.projectionMatrix;
    this.shader.uniforms.view = this.shaderPlugin.viewMatrix;
    this.shader.uniforms.model = scratch0;

    // use same atlas from voxel-shader TODO: can we reliably avoid binding? if already bound, seems to reuse
    if (this.stitchPlugin.texture) this.shader.uniforms.texture = this.stitchPlugin.texture.bind();

    this.mesh.bind();
    this.mesh.draw(gl.TRIANGLES, this.mesh.length);
    this.mesh.unbind();
  }
};
