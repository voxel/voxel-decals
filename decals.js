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
  loadAfter: ['voxel-mesher', 'voxel-shader']
};

function DecalsPlugin(game, opts) {
  this.game = game;
  this.shell = game.shell;

  this.mesherPlugin = game.plugins.get('voxel-mesher');
  if (!this.mesherPlugin) throw new Error('voxel-decals requires voxel-mesher');

  this.shaderPlugin = game.plugins.get('voxel-shader');
  if (!this.shaderPlugin) throw new Error('voxel-decals requires voxel-shader');

  this.colorVector = opts.color !== undefined ? opts.color : [0,1,1,1];

  this.info = [
    {position:[0,0,0], normal:[-1,0,0]},
    {position:[0,1,0], normal:[1,0,0]},
    {position:[0,2,0], normal:[0,1,0]},
    {position:[0,3,0], normal:[0,-1,0]},
    {position:[0,4,0], normal:[0,0,1]},
    {position:[0,5,0], normal:[0,0,-1]},
  ];

  this.enable();
}

DecalsPlugin.prototype.enable = function() {
  this.shell.on('gl-init', this.onInit = this.shaderInit.bind(this));
  this.shell.on('gl-render', this.onRender = this.render.bind(this));
};

DecalsPlugin.prototype.disable = function() {
  this.shell.removeListener('gl-render', this.onRender = this.render.bind(this));
  this.shell.removeListener('gl-init', this.onInit);
};

DecalsPlugin.prototype.shaderInit = function() {
  // TODO: refactor with voxel-decals, voxel-chunkborder?
  this.decalsShader = glslify({
    inline: true,
    vertex: "/* voxel-decals vertex shader */\
attribute vec3 position;\
uniform mat4 projection;\
uniform mat4 view;\
uniform mat4 model;\
void main() {\
  gl_Position = projection * view * model * vec4(position, 1.0);\
}",

  fragment: "/* voxel-decals fragment shader */\
precision highp float;\
uniform vec4 color;\
void main() {\
  gl_FragColor = color;\
}"})(this.shell.gl);

  this.update();
};

DecalsPlugin.prototype.update = function() {
  // cube face vertices, indexed by normal (based on box-geometry)
  var cube = {
    // Back face
    '-1|0|0': [
    0, 0, 1,
    1, 0, 1,
    1, 1, 1,

    0, 0, 1,
    1, 1, 1,
    0, 1, 1],

    // Front face
    '1|0|0': [
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
    '0|0|1': [
    1, 0, 0,
    1, 1, 0,
    1, 1, 1,

    1, 0, 0,
    1, 1, 1,
    1, 0, 1],

    // Right face
    '0|0|-1': [
    0, 0, 0,
    0, 0, 1,
    0, 1, 1,

    0, 0, 0,
    0, 1, 1,
    0, 1, 0],
  };

  var vertices = [];

  for (var i = 0; i < this.info.length; i += 1) {
    // start with plane corresponding to desired cube face
    var normal = this.info[i].normal;
    var plane = cube[normal.join('|')].slice(0);

    // translate into position
    for (var j = 0; j < plane.length; j += 1) {
      plane[j] += this.info[i].position[j % 3];
    }

    vertices = vertices.concat(plane);
  }

  var gl = this.shell.gl;

  var decalsBuf = createBuffer(gl, new Uint8Array(vertices));

  this.mesh = createVAO(gl, [
      { buffer: decalsBuf,
        type: gl.UNSIGNED_BYTE,
        size: 3
      }]);
  this.mesh.length = vertices.length/3;
};

var scratch0 = mat4.create();

DecalsPlugin.prototype.render = function() {
  if (true) {
    var gl = this.shell.gl;

    this.decalsShader.bind();
    this.decalsShader.attributes.position.location = 0;
    this.decalsShader.uniforms.projection = this.shaderPlugin.projectionMatrix;
    this.decalsShader.uniforms.view = this.shaderPlugin.viewMatrix;
    this.decalsShader.uniforms.color = this.colorVector;
    this.decalsShader.uniforms.model = scratch0;

    this.mesh.bind();
    this.mesh.draw(gl.TRIANGLES, this.mesh.length);
    this.mesh.unbind();
  }
};
