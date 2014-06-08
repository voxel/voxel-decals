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

  this.info = [
    {position:[0,1,0]},
    {position:[0,0,0]},
    ];

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
  // TODO: refactor with voxel-planes, voxel-chunkborder?
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


  var planesVertexArray = new Uint8Array([
    0, 1, 0, 1,
    0, 1, 1, 1,
    1, 1, 1, 1,
    1, 1, 0, 1,
  ]);

  // two adjacent triangles
  var indexArray = new Uint16Array([
    0, 1, 2,
    0, 2, 3,
  ]);

  var planesVertexCount = indexArray.length;

  var gl = this.shell.gl;

  var planesBuf = createBuffer(gl, planesVertexArray);
  var indexBuf = createBuffer(gl, indexArray, gl.ELEMENT_ARRAY_BUFFER);

  this.mesh = createVAO(gl, [
      { buffer: planesBuf,
        type: gl.UNSIGNED_BYTE,
        size: 4
      }], indexBuf);
  this.mesh.length = planesVertexCount;
};


var scratch0 = mat4.create();

PlanesPlugin.prototype.render = function() {
  if (true) {
    var gl = this.shell.gl;

    this.planesShader.bind();
    this.planesShader.attributes.position.location = 0;
    this.planesShader.uniforms.projection = this.shaderPlugin.projectionMatrix;
    this.planesShader.uniforms.view = this.shaderPlugin.viewMatrix;
    this.planesShader.uniforms.color = this.colorVector;

    for (var i = 0; i < this.info.length; i += 1) {
      mat4.identity(scratch0);
      mat4.translate(scratch0, scratch0, this.info[i].position);
      // TODO: via normal
      //mat4.rotateX(scratch0, scratch0, Math.PI/2); // back
      //mat4.rotateX(scratch0, scratch0, -Math.PI/2); + translate // front
      //mat4.rotateZ(scratch0, scratch0, -Math.PI/2);

      this.planesShader.uniforms.model = scratch0;

      this.mesh.bind();
      this.mesh.draw(gl.TRIANGLES, this.mesh.length);
      this.mesh.unbind();
    }
  }
};
