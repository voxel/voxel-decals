'use strict';

var createBuffer = require('gl-buffer');
var createVAO = require('gl-vao');
var glslify = require('glslify');
var glm = require('gl-matrix');
var mat4 = glm.mat4;

module.exports = function(game, opts) {
  return new PlanesPlugin(game, opts);
};
module.exports.pluginInfo = {
  loadAfter: ['voxel-mesher', 'voxel-shader']
};

function PlanesPlugin(game, opts) {
  this.game = game;
  this.shell = game.shell;

  this.mesherPlugin = game.plugins.get('voxel-mesher');
  if (!this.mesherPlugin) throw new Error('voxel-planes requires voxel-mesher');

  this.shaderPlugin = game.plugins.get('voxel-shader');
  if (!this.shaderPlugin) throw new Error('voxel-planes requires voxel-shader');

  this.colorVector = opts.color !== undefined ? opts.color : [0,1,1,1];

  this.modelMatrix = mat4.create(); // TODO

  this.enable();
}

PlanesPlugin.prototype.enable = function() {
  this.shell.on('gl-init', this.onInit = this.shaderInit.bind(this));
  this.shell.on('gl-render', this.onRender = this.render.bind(this));
};

PlanesPlugin.prototype.disable = function() {
  this.shell.removeListener('gl-render', this.onRender = this.render.bind(this));
  this.shell.removeListener('gl-init', this.onInit);
};

PlanesPlugin.prototype.shaderInit = function() {
  // TODO: refactor with voxel-outline, voxel-chunkborder?
  this.planesShader = glslify({
    inline: true,
    vertex: "/* voxel-planes vertex shader */\
attribute vec3 position;\
uniform mat4 projection;\
uniform mat4 view;\
uniform mat4 model;\
void main() {\
  gl_Position = projection * view * model * vec4(position, 1.0);\
}",

  fragment: "/* voxel-planes fragment shader */\
precision highp float;\
uniform vec4 color;\
void main() {\
  gl_FragColor = color;\
}"})(this.shell.gl);


  // copied from voxel-outline for now
  // TODO: plane, not box! + texturing

  var epsilon = 0.001;
  var w = 1 + epsilon;
  var outlineVertexArray = new Uint8Array([
    0,0,0,
    0,0,w,
    0,w,0,
    0,w,w,
    w,0,0,
    w,0,w,
    w,w,0,
    w,w,w
  ]);

  var indexArray = new Uint16Array([
    0,1, 0,2, 2,3, 3,1,
    0,4, 4,5, 5,1,
    5,7, 7,3,
    7,6, 6,2,
    6,4
  ]);

  var outlineVertexCount = indexArray.length;

  var gl = this.shell.gl;

  var outlineBuf = createBuffer(gl, outlineVertexArray);
  var indexBuf = createBuffer(gl, indexArray, gl.ELEMENT_ARRAY_BUFFER);

  var outlineVAO = createVAO(gl, [
      { buffer: outlineBuf,
        type: gl.UNSIGNED_BYTE,
        size: 3
      }], indexBuf);
  outlineVAO.length = outlineVertexCount;

  this.mesh = outlineVAO;
};


PlanesPlugin.prototype.render = function() {
  if (true) {
    var gl = this.shell.gl;

    this.planesShader.bind();
    this.planesShader.attributes.position.location = 0;
    this.planesShader.uniforms.projection = this.shaderPlugin.projectionMatrix;
    this.planesShader.uniforms.view = this.shaderPlugin.viewMatrix;
    this.planesShader.uniforms.color = this.colorVector;
    this.planesShader.uniforms.model = this.modelMatrix;
    var planesVAO = this.mesh;
    planesVAO.bind();
    planesVAO.draw(gl.LINES, planesVAO.length);
    planesVAO.unbind();
  }
};
