//
if (!vec3) var vec3 = glMatrix.vec3;
if (!vec4) var vec4 = glMatrix.vec4;
if (!mat3) var mat3 = glMatrix.mat3;
if (!mat4) var mat4 = glMatrix.mat4;

function WebGL(screen_width, screen_height, parent, webgl_class, canvas_class) {
  screen_width  = screen_width  || 300;
  screen_height = screen_height || 300;
  parent        = parent        || document.body;
  webgl_class   = webgl_class   || 'webgl';
  canvas_class  = webgl_class   || 'canvas';

  // creating webgl context

  const gl = document.createElement('canvas').getContext('webgl2', { preserveDrawingBuffer: true });
  gl.canvas.width = screen_width;
  gl.canvas.height = screen_height;
  gl.canvas.classList.add(webgl_class);
  parent.appendChild(gl.canvas);

  // creating 2d context (optional)

  const ctx = document.createElement('canvas').getContext('2d');
  ctx.canvas.width = screen_width;
  ctx.canvas.height = screen_height;
  ctx.canvas.classList.add(canvas_class);
  ctx.canvas.imageSmoothingEnabled = false;
  parent.appendChild(ctx.canvas);

  // viewport

  const viewport = [0, 0, screen_width, screen_height];

  // preparing scene

  gl.viewport(...viewport);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  gl.clearDepth(1.0);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // enabling alpha-blending (you must sort transparent models by yourself)

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // blank textures

  const EMPTY_TEXTURE = create_texture();
  const EMPTY_NORMALMAP = create_texture(new Uint8Array([128, 128, 255, 255]));

  // version (debug)

  console.log(`%c ${gl.getParameter(gl.VERSION)}`, 'color: blue;');
  console.log(`%c ${gl.getParameter(gl.SHADING_LANGUAGE_VERSION)}`, 'color: blue;');

  ///////////////////////////////////////////////////////////////////////


  function compile_shader(type, data) {
    if (type !== gl.VERTEX_SHADER
    &&  type !== gl.FRAGMENT_SHADER)
    {
      throw Error(`compile_shader:: '${type}' is not type of shader`);
    }
    const type_str = type === gl.VERTEX_SHADER ? 'VERTEX_SHADER' : 'FRAGMENT_SHADER';
    const shader = gl.createShader(type);
    gl.shaderSource(shader, data);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw Error(`'compile_shader:: ${type_str}:: ${gl.getShaderInfoLog(shader)}`);
    }
    return shader;
  }


  function create_shader_program(...shaders) {
    const program = gl.createProgram();
    for (let shader of shaders) {
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    gl.useProgram(program);
    return program;
  }


  function define_uniform_locations(shader_program, dict, prefix = '') {
    // All locations will be stored in 'dict' (values will be rewrited), returns 'dict'.
    for (let key in dict) {
      // Value can be Object, String or neither.
      if (dict[key] instanceof Object) {
        if ('_array_' in dict[key]) {
          // If value is Object and has pseudokey '_array_',
          // then all keys in this object maps into array with
          // length === '_array_'.
          const arrlen = dict[key]['_array_'];
          delete dict[key]['_array_'];
          dict[key] = Array(arrlen).fill().map((_, i) => {
            let name = `${key}[${i}]`;
            if (prefix.length) name = `${prefix}.${name}`;
            return define_uniform_locations(shader_program, {...dict[key]}, name);
          });
        } else {
          // If value is Object, then value recoursively parses into key.
          let name = key;
          if (prefix.length) name = `${prefix}.${name}`;
          define_uniform_locations(shader_program, dict[key], name);
        }
      } else if (typeof dict[key] === 'string') {
        // If value is String, then getting location with name stored in value.
        let name = dict[key];
        if (prefix.length) name = `${prefix}.${name}`;
        dict[key] = gl.getUniformLocation(shader_program, name);
      } else {
        // Else, gentting location with name stored in key.
        let name = key;
        if (prefix.length) name = `${prefix}.${name}`;
        dict[key] = gl.getUniformLocation(shader_program, name);
      }
    }
    return dict;
  }


  function define_attrib_locations(shader_program, dict) {
    // TODO: make something like define_uniform_locations
    for (let key in dict) {
      const name = typeof dict[key] === 'string' ? dict[key] : key;
      dict[key] = gl.getAttribLocation(shader_program, name);
      if (dict[key] < 0) {
        console.log(`define_attrib_locations:: attribute '${name}' unused`);
      }
    }
    return dict;
  }


  function create_texture(image, width, height) {
    width  = width  || 1;
    height = height || 1;
    let pixels;

    if (image == null) {
      width  = 1;
      height = 1;
      pixels = new Uint8Array([255, 255, 255, 255]);
    }

    else if (image instanceof Image) {
      width  = image.width;
      height = image.height;
      pixels = image;
    }

    else if (image instanceof Uint8Array) {
      pixels = image;
    }

    else {
      throw Error(`create_texture:: 'image' has unsupported type`);
    }

    ///////////////////////////////////
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,    // target
      0,                // level
      gl.RGBA,          // internalformat
      width,            // width
      height,           // height
      0,                // border
      gl.RGBA,          // format
      gl.UNSIGNED_BYTE, // type
      pixels,           // pixels
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }


  function bind_array_buffer(index, srcData, size, type, buffer = null) {
    if (index < 0) return null; // provided attribute unused
    buffer = buffer || gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, srcData, gl.STATIC_DRAW);
    gl.vertexAttribPointer(index, size, type, false, 0, 0);
    gl.enableVertexAttribArray(index); // always after binding vao
    return buffer;
  }


  function bind_element_buffer(srcData, buffer = null) {
    buffer = buffer || gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, srcData, gl.STATIC_DRAW);
    return buffer;
  }


  function bind_vao(vao = null) {
    vao = vao || gl.createVertexArray();
    gl.bindVertexArray(vao);
    return vao;
  }


  function get_bounding_rect() {
    // bounding rect changes in runtime
    return gl.canvas.getBoundingClientRect();
  }


  //////////////////////////////////////////////////////////////////


  return {
    // context itself
    gl,
    // 2d layout
    ctx,
    // object with context and methods
    webgl: {
      gl,
      viewport,
      EMPTY_TEXTURE,
      EMPTY_NORMALMAP,
      //////////////////////////
      compile_shader,
      create_shader_program,
      define_uniform_locations,
      define_attrib_locations,
      create_texture,
      bind_array_buffer,
      bind_element_buffer,
      bind_vao,
      get_bounding_rect,
    },
  }
}


//////////////////////////////////////////////////////
//                                                  //
//  GL UTILS (TODO: MUST BE DECLARED IN OTHER FILE) //
//                                                  //
//////////////////////////////////////////////////////


// creates matrices stack
WebGL.create_stack_mat4 = function () {
  return {
    stack: [],
    pop(m) { mat4.copy(m, this.stack.pop()); },
    push(m) { this.stack.push(mat4.clone(m)); },
  };
}


// projects 3D point into 2D screen space
WebGL.project = function (out, v, viewport, m) {
  const view_x = viewport[0];
  const view_y = viewport[1];
  const view_w = viewport[2];
  const view_h = viewport[3];

  const [x, y, z] = vec3.transformMat4([], v, m);

  if (z > 0 && z < 1 && z > 0 && z < 1) {
    out[0] = (x / +z + 1) * (view_w >> 1) + view_x;
    out[1] = (y / -z + 1) * (view_h >> 1) + view_y;
    out[2] = z;
  }

  return out;
}


 // unprojects 2D point in screen space into 3D space
WebGL.unproject = function (out, v, viewport, m) {
  // source: https://github.com/Jam3/camera-unproject
  const view_x = viewport[0];
  const view_y = viewport[1];
  const view_w = viewport[2];
  const view_h = viewport[3];

  // Normalized Device Coordinates (NDC)
  const nx = 2 * (         v[0] - view_x    ) / view_w - 1;
  const ny = 2 * (view_h - v[1] - view_y - 1) / view_h - 1;
  const nz = 2 * (         v[2] || 0        )          - 1; // v[2]=0 means "near plane"

  m = mat4.invert([], m);
  const [x, y, z, w] = vec4.transformMat4([], [nx, ny, nz, 1], m);

  out[0] = x / w;
  out[1] = y / w;
  out[2] = z / w;

  return out;
}


// creates fps camera
WebGL.create_camera = function (o) {
  return {
    position: [0, 0, -10], // position inverted
    pitch: 0,
    yaw: 0,
    roll: 0, // disabled
    d_forward: 0,
    d_strafe: 0,
    d_up: 0,
    forward: [],
    strafe: [],
    up: [],
    center: [],
    mat_view: mat4.create(),
    apply(m) {
      // source: http://www.opengl-tutorial.org/beginners-tutorials/tutorial-6-keyboard-and-mouse/
      this.forward[0] = Math.cos(this.pitch) * Math.sin(this.yaw);
      this.forward[1] = Math.sin(this.pitch);
      this.forward[2] = Math.cos(this.pitch) * Math.cos(this.yaw);
      this.strafe[0] = Math.sin(this.yaw - Math.PI / 2);
      this.strafe[1] = 0;
      this.strafe[2] = Math.cos(this.yaw - Math.PI / 2);
      vec3.cross(this.up, this.strafe, this.forward);
      vec3.scaleAndAdd(this.position, this.position, this.forward, this.d_forward);
      vec3.scaleAndAdd(this.position, this.position, this.strafe, this.d_strafe);
      vec3.scaleAndAdd(this.position, this.position, this.up, this.d_up);
      this.d_forward = this.d_strafe = this.d_up = 0;
      vec3.add(this.center, this.position, this.forward);
      mat4.lookAt(this.mat_view, this.position, this.center, this.up);
      mat4.multiply(m, m, this.mat_view);
      return m;
    },
  };
}


// creates face normal
WebGL.create_face_normal = function (x1, y1, z1, x2, y2, z2, x3, y3, z3) {
  // source: https://www.khronos.org/opengl/wiki/Calculating_a_Surface_Normal
  //       p2
  //  _   ^  \
  //  U  /    \
  //    /      \
  //   /        \
  //  p1------->p3
  //       _
  //       V
  const Ux = x2 - x1;
  const Uy = y2 - y1;
  const Uz = z2 - z1;
  const Vx = x3 - x1;
  const Vy = y3 - y1;
  const Vz = z3 - z1;
  const Nx = Uy * Vz - Uz * Vy;
  const Ny = Uz * Vx - Ux * Vz;
  const Nz = Ux * Vy - Uy * Vx;
  // normalize
  const Nmag = Math.sqrt(Nx * Nx + Ny * Ny + Nz * Nz);
  return [Nx / Nmag, Ny / Nmag, Nz / Nmag];
}


// btn
WebGL.create_tangents = function (tangents, bitangents, { coordinates, texcoords, indices }) {
  // source: https://habr.com/ru/post/415579/
  // related: https://community.khronos.org/t/how-to-calculate-tbn-matrix/64002

  tangents = tangents || [];
  bitangents = bitangents || [];

  for (let indices_index = 0; indices_index < indices.length; ) {
    const _indices = [
      indices[indices_index++],
      indices[indices_index++],
      indices[indices_index++],
    ];

    const _coordinates = _indices.map(i => [
      coordinates[i * 3 + 0],
      coordinates[i * 3 + 1],
      coordinates[i * 3 + 2],
    ]);

    const _texcoords = _indices.map(i => [
      texcoords[i * 2 + 0],
      texcoords[i * 2 + 1],
    ]);

    const edge1 = Array(3).fill().map((_, i) => _coordinates[1][i] - _coordinates[0][i]); // pos2 - pos1;
    const edge2 = Array(3).fill().map((_, i) => _coordinates[2][i] - _coordinates[0][i]); // pos3 - pos1;
    const dUV1  = Array(2).fill().map((_, i) => _texcoords[1][i] - _texcoords[0][i]); // uv2 - uv1;
    const dUV2  = Array(2).fill().map((_, i) => _texcoords[2][i] - _texcoords[0][i]); // uv3 - uv1;
    const f = 1.0 / (dUV1[0] * dUV2[1] - dUV2[0] * dUV1[1]);

    const tangent = [
      f * (dUV2[1] * edge1[0] - dUV1[1] * edge2[0]),
      f * (dUV2[1] * edge1[1] - dUV1[1] * edge2[1]),
      f * (dUV2[1] * edge1[2] - dUV1[1] * edge2[2]),
    ];
    const tmag = Math.hypot(...tangent);
    tangents.push(...tangent.map(e => e / tmag));

    const bitangent = [
      f * (-dUV2[0] * edge1[0] + dUV1[0] * edge2[0]),
      f * (-dUV2[0] * edge1[1] + dUV1[0] * edge2[1]),
      f * (-dUV2[0] * edge1[2] + dUV1[0] * edge2[2]),
    ];
    const bmag = Math.hypot(...bitangent);
    bitangents.push(...bitangent.map(e => e / bmag));
  }

  return {
    tangents,
    bitangents,
  };
}


// draws btn
WebGL.draw_btn = function (
  ctx, viewport, matrix,
  { coordinates, normals, tangents, bitangents, indices },
  indices_start, indices_number)
{
  indices_start = indices_start || 0;
  indices_number = indices_number || (indices.length - indices_start);
  const scaler = 0.1;

  for (let i = indices_start; i < indices_start + indices_number; ++i) {
    const ii = indices[i];
    const p1 = [
      coordinates[ii * 3 + 0],
      coordinates[ii * 3 + 1],
      coordinates[ii * 3 + 2],
    ];
    const p2 = [
      normals[ii * 3 + 0] * scaler + p1[0],
      normals[ii * 3 + 1] * scaler + p1[1],
      normals[ii * 3 + 2] * scaler + p1[2],
    ];
    const p3 = [
      tangents[ii * 3 + 0] * scaler + p1[0],
      tangents[ii * 3 + 1] * scaler + p1[1],
      tangents[ii * 3 + 2] * scaler + p1[2],
    ];
    const p4 = [
      bitangents[ii * 3 + 0] * scaler + p1[0],
      bitangents[ii * 3 + 1] * scaler + p1[1],
      bitangents[ii * 3 + 2] * scaler + p1[2],
    ];
    const v1 = [];
    const v2 = [];
    const v3 = [];
    const v4 = [];
    WebGL.project(v1, p1, viewport, matrix);
    WebGL.project(v2, p2, viewport, matrix);
    WebGL.project(v3, p3, viewport, matrix);
    WebGL.project(v4, p4, viewport, matrix);
    // normal
    if (v1 && v2) {
      ctx.fillStyle = ctx.strokeStyle = 'blue';
      ctx.beginPath();
      ctx.moveTo(v1[0], v1[1]);
      ctx.lineTo(v2[0], v2[1]);
      ctx.stroke();
    }
    // tangent
    if (v1 && v3) {
      ctx.fillStyle = ctx.strokeStyle = 'red';
      ctx.beginPath();
      ctx.moveTo(v1[0], v1[1]);
      ctx.lineTo(v3[0], v3[1]);
      ctx.stroke();
    }
    // // bitangent
    // if (v1 && v4) {
    //   ctx.fillStyle = ctx.strokeStyle = 'green';
    //   ctx.beginPath();
    //   ctx.moveTo(v1[0], v1[1]);
    //   ctx.lineTo(v4[0], v4[1]);
    //   ctx.stroke();
    // }
  }
}


WebGL.create_cube = function () {

  const coordinates = [
    0.0, 0.0, 1.0,    1.0, 0.0, 1.0,    1.0, 1.0, 1.0,    0.0, 1.0, 1.0, // Front
    0.0, 0.0, 0.0,    0.0, 1.0, 0.0,    1.0, 1.0, 0.0,    1.0, 0.0, 0.0, // Back
    0.0, 1.0, 0.0,    0.0, 1.0, 1.0,    1.0, 1.0, 1.0,    1.0, 1.0, 0.0, // Top
    0.0, 0.0, 0.0,    1.0, 0.0, 0.0,    1.0, 0.0, 1.0,    0.0, 0.0, 1.0, // Bottom
    1.0, 0.0, 0.0,    1.0, 1.0, 0.0,    1.0, 1.0, 1.0,    1.0, 0.0, 1.0, // Right
    0.0, 0.0, 0.0,    0.0, 0.0, 1.0,    0.0, 1.0, 1.0,    0.0, 1.0, 0.0, // Left
  ];

  const normals = [
     0.0,  0.0, +1.0,    0.0,  0.0, +1.0,    0.0,  0.0, +1.0,    0.0,  0.0, +1.0, // Front
     0.0,  0.0, -1.0,    0.0,  0.0, -1.0,    0.0,  0.0, -1.0,    0.0,  0.0, -1.0, // Back
     0.0, +1.0,  0.0,    0.0, +1.0,  0.0,    0.0, +1.0,  0.0,    0.0, +1.0,  0.0, // Top
     0.0, -1.0,  0.0,    0.0, -1.0,  0.0,    0.0, -1.0,  0.0,    0.0, -1.0,  0.0, // Bottom
    +1.0,  0.0,  0.0,   +1.0,  0.0,  0.0,   +1.0,  0.0,  0.0,   +1.0,  0.0,  0.0, // Right
    -1.0,  0.0,  0.0,   -1.0,  0.0,  0.0,   -1.0,  0.0,  0.0,   -1.0,  0.0,  0.0, // Left
  ];

  const colors = [
    1.0, 0.0, 0.0, 1.0,  1.0, 0.0, 0.0, 1.0,  1.0, 0.0, 0.0, 1.0,  1.0, 0.0, 0.0, 1.0, // Front (red)
    0.0, 1.0, 0.0, 1.0,  0.0, 1.0, 0.0, 1.0,  0.0, 1.0, 0.0, 1.0,  0.0, 1.0, 0.0, 1.0, // Back (green)
    1.0, 0.0, 1.0, 1.0,  1.0, 0.0, 1.0, 1.0,  1.0, 0.0, 1.0, 1.0,  1.0, 0.0, 1.0, 1.0, // Top (magenta)
    0.0, 1.0, 1.0, 1.0,  0.0, 1.0, 1.0, 1.0,  0.0, 1.0, 1.0, 1.0,  0.0, 1.0, 1.0, 1.0, // Bottom (cyan)
    0.0, 0.0, 1.0, 1.0,  0.0, 0.0, 1.0, 1.0,  0.0, 0.0, 1.0, 1.0,  0.0, 0.0, 1.0, 1.0, // Right (blue)
    1.0, 1.0, 0.0, 1.0,  1.0, 1.0, 0.0, 1.0,  1.0, 1.0, 0.0, 1.0,  1.0, 1.0, 0.0, 1.0, // Left (yellow)
  ];

  const texcoords = [
    0.0, 1.0,   1.0, 1.0,   1.0, 0.0,   0.0, 0.0, // Front
    1.0, 1.0,   1.0, 0.0,   0.0, 0.0,   0.0, 1.0, // Back
    0.0, 0.0,   0.0, 1.0,   1.0, 1.0,   1.0, 0.0, // Top
    0.0, 1.0,   1.0, 1.0,   1.0, 0.0,   0.0, 0.0, // Bottom
    1.0, 1.0,   1.0, 0.0,   0.0, 0.0,   0.0, 1.0, // Right
    0.0, 1.0,   1.0, 1.0,   1.0, 0.0,   0.0, 0.0, // Left
  ];

  const indices = [
     0,  1,  2,    2,  3,  0, // Front
     4,  5,  6,    6,  7,  4, // Back
     8,  9, 10,   10, 11,  8, // Top
    12, 13, 14,   14, 15, 12, // Bottom
    16, 17, 18,   18, 19, 16, // Right
    20, 21, 22,   22, 23, 20, // Left
  ];

  const tangents = [
    +1,  0,  0,    +1,  0,  0,    +1,  0,  0,    +1,  0,  0, // Front
    -1,  0,  0,    -1,  0,  0,    -1,  0,  0,    -1,  0,  0, // Back
    +1,  0,  0,    +1,  0,  0,    +1,  0,  0,    +1,  0,  0, // Top
    +1,  0,  0,    +1,  0,  0,    +1,  0,  0,    +1,  0,  0, // Bottom
     0,  0, -1,     0,  0, -1,     0,  0, -1,     0,  0, -1, // Right
     0,  0, +1,     0,  0, +1,     0,  0, +1,     0,  0, +1, // Left
  ];

  return {
    coordinates,
    texcoords,
    tangents,
    normals,
    indices,
    colors,
  };
}


// creates safe accessor
WebGL.create_accessor = function (o) {
  function accessor(key) {
    if (key in o) return o[key];
    throw Error(`accessor:: key '${key}' does not exist`);
  }
  accessor._itself_ = o;
  return accessor;
}


// cvt_mat4_to_mat3
WebGL.cvt_mat4_to_mat3 = function (out, m4) {
  out = [
    m4[ 0], m4[ 1], m4[ 2],
    m4[ 4], m4[ 5], m4[ 6],
    m4[ 8], m4[ 9], m4[10],
  ];
  return out;
}
