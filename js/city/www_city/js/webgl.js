//
if (!vec3) var vec3 = glMatrix.vec3;
if (!vec4) var vec4 = glMatrix.vec4;
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

  // blank texture

  const empty_texture = create_texture();


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
      gl.enableVertexAttribArray(dict[key]);
      const errcode = gl.getError();
      if (errcode !== 0) {
        console.log(`define_attrib_locations:: while linking '${name}' attribute error (${errcode}) occured`);
      }
    }
    return dict;
  }


  function create_texture(image = null) {
    const width  = image ? image.width  : 1;
    const height = image ? image.height : 1;
    const pixels = image || new Uint8Array([255, 255, 255, 255]);
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
    // https://www.khronos.org/registry/OpenGL-Refpages/gl2.1/xhtml/glTexParameter.xml
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }


  function bind_array_buffer(a_location, typed_array, size, type, buffer = null) {
    buffer = buffer || gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, typed_array, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_location, size, type, false, 0, 0);
    return buffer;
  }


  function bind_element_buffer(typed_array, buffer = null) {
    buffer = buffer || gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, typed_array, gl.STATIC_DRAW);
    return buffer;
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
      empty_texture,
      //////////////////////////
      compile_shader,
      create_shader_program,
      define_uniform_locations,
      define_attrib_locations,
      create_texture,
      bind_array_buffer,
      bind_element_buffer,
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
  const Nmag = Math.sqrt(Nx * Nx + Ny * Ny + Nz * Nz);
  return [Nx / Nmag, Ny / Nmag, Nz / Nmag];
}


// draws normals
WebGL.draw_vertex_normals = function (ctx, viewport, matrix, coordinates, normals, indices, indices_start, indices_number) {
  indices_start = indices_start || 0;
  indices_number = indices_number || (indices.length - indices_start);
  ctx.beginPath();
  for (let i = indices_start; i < indices_start + indices_number; ++i) {
    const ii = indices[i];
    const p1 = [
      coordinates[ii * 3 + 0],
      coordinates[ii * 3 + 1],
      coordinates[ii * 3 + 2],
    ];
    const p2 = [
      normals[ii * 3 + 0] + p1[0],
      normals[ii * 3 + 1] + p1[1],
      normals[ii * 3 + 2] + p1[2],
    ];
    const v1 = [];
    const v2 = [];
    WebGL.project(v1, p1, viewport, matrix);
    WebGL.project(v2, p2, viewport, matrix);
    if (v1 && v2) {
      ctx.moveTo(v1[0], v1[1]);
      ctx.lineTo(v2[0], v2[1]);
      ctx.fillText(ii, v2[0], v2[1]);
    }
  }
  ctx.stroke();
}


// defines cube
WebGL.create_cube = function () {
  /*
   * (1) 0,1--->1,1 (2)
   *      ^[1]/ ^|
   *      |  / / |
   *      | / /  |
   *      |v /[2]v
   * (0) 0,0<---1,0 (3)
   */
  return {
    // coordinates
    coordinates: [
      0, 0, 0,   0, 1, 0,   1, 1, 0,   1, 0, 0, // front (red)
      0, 0, 1,   0, 1, 1,   1, 1, 1,   1, 0, 1, // back (green)
      0, 0, 0,   0, 0, 1,   1, 0, 1,   1, 0, 0, // botton (magenta)
      0, 1, 0,   0, 1, 1,   1, 1, 1,   1, 1, 0, // top (cyan)
      0, 0, 0,   0, 1, 0,   0, 1, 1,   0, 0, 1, // left (blue)
      1, 0, 0,   1, 1, 0,   1, 1, 1,   1, 0, 1, // right (yellow)
    ],
    // normals
    normals: [
      0,  0, -1,    0,  0, -1,    0,  0, -1,    0,  0, -1, // front (red)
      0,  0, +1,    0,  0, +1,    0,  0, +1,    0,  0, +1, // back (green)
      0, -1,  0,    0, -1,  0,    0, -1,  0,    0, -1,  0, // botton (magenta)
      0, +1,  0,    0, +1,  0,    0, +1,  0,    0, +1,  0, // top (cyan)
     -1,  0,  0,   -1,  0,  0,   -1,  0,  0,   -1,  0,  0, // left (blue)
     +1,  0,  0,   +1,  0,  0,   +1,  0,  0,   +1,  0,  0, // right (yellow)
    ],
    // indices
    indices: [
       0,  1,  2,  2,  3,  0, // front (red)
       4,  5,  6,  6,  7,  4, // back (green)
       8,  9, 10, 10, 11,  8, // botton (magenta)
      12, 13, 14, 14, 15, 12, // top (cyan)
      16, 17, 18, 18, 19, 16, // left (blue)
      20, 21, 22, 22, 23, 20, // right (yellow)
    ],
    // vertices colors
    colors: [
      1.0, 0.0, 0.0, 1.0,  1.0, 0.0, 0.0, 1.0,  1.0, 0.0, 0.0, 1.0,  1.0, 0.0, 0.0, 1.0, // front (red)
      0.0, 1.0, 0.0, 1.0,  0.0, 1.0, 0.0, 1.0,  0.0, 1.0, 0.0, 1.0,  0.0, 1.0, 0.0, 1.0, // back (green)
      1.0, 0.0, 1.0, 1.0,  1.0, 0.0, 1.0, 1.0,  1.0, 0.0, 1.0, 1.0,  1.0, 0.0, 1.0, 1.0, // botton (magenta)
      0.0, 1.0, 1.0, 1.0,  0.0, 1.0, 1.0, 1.0,  0.0, 1.0, 1.0, 1.0,  0.0, 1.0, 1.0, 1.0, // top (cyan)
      0.0, 0.0, 1.0, 1.0,  0.0, 0.0, 1.0, 1.0,  0.0, 0.0, 1.0, 1.0,  0.0, 0.0, 1.0, 1.0, // left (blue)
      1.0, 1.0, 0.0, 1.0,  1.0, 1.0, 0.0, 1.0,  1.0, 1.0, 0.0, 1.0,  1.0, 1.0, 0.0, 1.0, // right (yellow)
    ],
    // texture coordinates
    texcoords: [
      1, 1,   1, 0,   0, 0,   0, 1, // front (red)
      0, 1,   0, 0,   1, 0,   1, 1, // back (green)
      1, 0,   1, 1,   0, 1,   0, 0, // botton (magenta)
      1, 1,   1, 0,   0, 0,   0, 1, // top (cyan)
      0, 1,   0, 0,   1, 0,   1, 1, // left (blue)
      1, 1,   1, 0,   0, 0,   0, 1, // right (yellow)
    ],
  };
}


// creates safe accessor
WebGL.create_accessor = function (o) {
  function accessor(key) {
    if (key in o) return o[key];
    throw Error(`accessor:: key '${key}' does not exist`);
  }
  return accessor;
}


// starts demo
WebGL.demo = function (parent) {
  parent = parent || document.body;

  const screen_width = 400;
  const screen_height = 250;

  const { gl, webgl } = WebGL(screen_width, screen_height, parent);

  // --------------- shaders --------------------

  const raw_vertex_shader =
  `
    precision mediump float;

    struct DirectionalLight {
      vec3 direction;
      vec3 color;
    };

    attribute vec3 a_coord;
    attribute vec4 a_color;
    attribute vec3 a_normal;

    uniform mat4 u_view;
    uniform mat4 u_normal;
    uniform vec3 u_ambient_light;
    uniform DirectionalLight u_directional_light;

    varying vec4 v_color;
    varying vec3 v_light;

    void main(void) {
      v_color = a_color;

      // making light
      vec4 transformed_normal = u_normal * vec4(a_normal, 1.0);
      float directional_light = max(dot(transformed_normal.xyz, u_directional_light.direction), 0.0);
      v_light = u_ambient_light + (u_directional_light.color * directional_light);

      gl_Position = u_view * vec4(a_coord, 1.0);
      gl_PointSize = 3.0;
    }
  `;

  const raw_fragment_shader =
  `
    precision mediump float;

    varying vec4 v_color;
    varying vec3 v_light;

    void main(void) {
      gl_FragColor = vec4(v_color.rgb * v_light, v_color.a);
    }
  `;

  const vertex_shader = webgl.compile_shader(gl.VERTEX_SHADER, raw_vertex_shader);
  const fragment_shader = webgl.compile_shader(gl.FRAGMENT_SHADER, raw_fragment_shader);
  const shader_program = webgl.create_shader_program(vertex_shader, fragment_shader);

  const u_loc = {
    view: 'u_view',
    normal: 'u_normal',
    ambient_light: 'u_ambient_light',
    directional_light: {
      color: 'u_directional_light.color',
      direction: 'u_directional_light.direction',
    },
  };

  const a_loc = {
    coord: 'a_coord',
    color: 'a_color',
    normal: 'a_normal',
  };

  webgl.define_uniform_locations(shader_program, u_loc);
  webgl.define_attrib_locations(shader_program, a_loc);

  // ------------- VBO --------------

  const cube = WebGL.create_cube();

  webgl.bind_array_buffer(a_loc.coord,  new Float32Array(cube.coordinates), 3, gl.FLOAT);
  webgl.bind_array_buffer(a_loc.color,  new Float32Array(cube.colors),      4, gl.FLOAT);
  webgl.bind_array_buffer(a_loc.normal, new Float32Array(cube.normals),     3, gl.FLOAT);
  webgl.bind_element_buffer(new Uint16Array(cube.indices));

  // ------------ lights -------------

  webgl.set_ambient_light(u_loc.ambient_light, [0.5, 0.5, 0.5]);
  webgl.set_directional_light(u_loc.directional_light, [0.5, 0.5, 0.5], [0.85, 0.80, 0.75]);

  // ------------ matrices -------------

  const mat_projection = mat4.create();
  mat4.perspective(mat_projection, Math.PI / 4, screen_width / screen_height, 0.1, 100.0);
  mat4.translate(mat_projection, mat_projection, [-0.5, -0.5, -5]);

  const mat_modelview = mat4.create();

  // ------------ draw ---------------

  setInterval(render, 100);

  function render() {
    // rotate modelview matrix
    mat4.translate(mat_modelview, mat_modelview, [+0.5, +0.5, +0.5]);
    mat4.rotateX(mat_modelview, mat_modelview, +0.10);
    mat4.rotateY(mat_modelview, mat_modelview, -0.10);
    mat4.rotateZ(mat_modelview, mat_modelview, +0.15);
    mat4.translate(mat_modelview, mat_modelview, [-0.5, -0.5, -0.5]);

    // matrices multiplication done on client side
    const view = mat4.create();
    mat4.multiply(view, mat_projection, mat_modelview);

    // for lighting
    const normal = mat4.create();
    mat4.invert(normal, mat_modelview);
    mat4.transpose(normal, normal);

    // sending
    gl.uniformMatrix4fv(u_loc.view, false, view);
    gl.uniformMatrix4fv(u_loc.normal, false, normal);

    // render
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, cube.indices.length, gl.UNSIGNED_SHORT, 0);
  }
}
