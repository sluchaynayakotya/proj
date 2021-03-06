//
function Graphics(screen_width, screen_height, parent) {
  parent = parent || document.body;

  if (!WebGL) throw Error('Graphics:: WebGL not found');
  if (!Canvas) throw Error('Graphics:: Canvas not found');

  const { gl, webgl } = WebGL(screen_width, screen_height, parent);
  const ctx = Canvas(screen_width, screen_height, parent);

  const bounding_client_rect = ctx.canvas.getBoundingClientRect(); // must be same as gl.canvas

  const shader_program = webgl.create_shader_program(
    webgl.compile_shader(gl.VERTEX_SHADER, DATA__vertex_shader),
    webgl.compile_shader(gl.FRAGMENT_SHADER, DATA__fragment_shader),
  );

  const u_loc = webgl.define_uniform_locations(shader_program, {
    view: 'u_view',
    normal: 'u_normal',
    ambient_light: 'u_ambient_light',
    directional_light: {
      color: 'u_directional_light.color',
      direction: 'u_directional_light.direction',
    },
    offsets: 'u_offsets',
  });

  const a_loc = webgl.define_attrib_locations(shader_program, {
    coord: 'a_coord',
    color: 'a_color',
    normal: 'a_normal',
  });

  const directional_light_direction = [0.5, 0.75, 1];

  webgl.set_ambient_light(u_loc.ambient_light, [0.5, 0.5, 0.5]);
  webgl.set_directional_light(u_loc.directional_light, [1.0, 1.0, 1.0], directional_light_direction);

  const triangle = Graphics.create_triangle();

  const color_array_buffer = webgl.bind_array_buffer(a_loc.color, new Float32Array(triangle.colors), 4, gl.FLOAT);
  webgl.bind_array_buffer(a_loc.coord,  new Float32Array(triangle.coordinates), 3, gl.FLOAT);
  webgl.bind_array_buffer(a_loc.normal, new Float32Array(triangle.normals),     3, gl.FLOAT);
  webgl.bind_element_buffer(new Uint16Array(triangle.indices));


  // const mdncube = Graphics.create_MDN_cube();
  // webgl.bind_array_buffer(a_loc.color, new Float32Array(mdncube.colors),       4, gl.FLOAT);
  // webgl.bind_array_buffer(a_loc.coord,  new Float32Array(mdncube.coordinates), 3, gl.FLOAT);
  // webgl.bind_array_buffer(a_loc.normal, new Float32Array(mdncube.normals),     3, gl.FLOAT);
  // webgl.bind_element_buffer(new Uint16Array(mdncube.indices));


  const mat_projection = mat4.create();
  const FOV    = Math.PI / 4;
  const RATIO  = screen_width / screen_height;
  const Z_NEAR = 0.1;
  const Z_FAR  = 100.0;
  mat4.perspective(mat_projection, FOV, RATIO, Z_NEAR, Z_FAR);

  const mat_modelview = mat4.create();

  const Stack = WebGL.create_stack_mat4();

  // -------------------------------------

  const camera_zoom = 5;
  const camera_height = 0;
  const camera_position = [0, -camera_height, -camera_zoom];
  const camera_rotation = [22.5 * Math.PI / 180, +0.0, +0.0];

  // const scene_origin = triangle.center_actual;
  // const scene_next_origin = triangle.center_reversed;
  // const scene_next_origin_vector = triangle.center_actual.map((e, i) => triangle.center_reversed[i] - e);
  // let scene_next_origin_vector_scaler = 0.0;

  const camera_rotation_speed = 0.005;


  const map_width = 10;
  const map_height = 10;
  const map = [...Array(map_width * map_height)].map(e => Math.random() < 0.5 ? 0 : Math.random() * 10 | 0);
  // const map = [...Array(map_width * map_height)].map(e => 1 + Math.random() * 9 | 0);


  function map_get(x, y) {
    if ((x %= map_width) < 0) x += map_width;
    if ((y %= map_height) < 0) y += map_height;
    return map[x + y * map_width];
  }


  let player_x = 0;
  let player_y = 0;
  const player_view_dist_x = 10;
  const player_view_dist_y = 10;

  // ------------ map configuration -------

  // Logic map example:
  // .------------------->X
  // |
  // |  [0][1][2][3][4][5]
  // |  [6][7][8][9][A][B]
  // v
  // Z
  //
  // Visual map example:
  // .--------------------------->X
  // |        ,_____,_____,_____,
  // |       /0\ 1 /2\ 3 /4\ 5 /
  // |     ,/___\,/___\,/___\,/
  // |    /6\ 7 /8\ 9 /A\ B /
  // v   /___\,/___\,/___\,/
  // Z
  //
  // Moving rules:
  //
  // INDEX(X, Y) = X + Y * ROW_LENGTH;
  //
  // If player stands on odd index, he can move
  // UP: X - 1, Y - 1, neither DOWN: X + 1, Y + 1.
  // Also player always can move LEFT: X - 1 or RIGHT: X + 1.

  // -------------------------------------

  function project_line(v1, v2, m, text = null, myctx) {
    if (!myctx) myctx = ctx;

    const viewport = [0, 0, screen_width, screen_height];
    v1 = WebGL.project([], v1, viewport, m);
    v2 = WebGL.project([], v2, viewport, m);

    myctx.beginPath();
    myctx.moveTo(...v1);
    myctx.lineTo(...v2);
    myctx.stroke();

    if (text !== null) myctx.fillText(text, ...v2);
  }


  function draw_vector_source(v, m, radius, text = null, myctx) {
    if (!myctx) myctx = ctx;

    const viewport = [0, 0, screen_width, screen_height];
    v1 = WebGL.project([], v, viewport, m);

    myctx.beginPath();
    myctx.arc(...v1, radius, 0, 2 * Math.PI);
    myctx.stroke();

    if (text !== null) myctx.fillText(text, v1[0] + radius, v1[1]);
  }


  function draw_normals(coordinates, normals, indices) {
    for (let i = 0; i < indices.length; ++i) {
      const index = indices[i];

      const v1 = [
        coordinates[0 + 3 * index],
        coordinates[1 + 3 * index],
        coordinates[2 + 3 * index],
      ];

      const v2 = [
        v1[0] + normals[0 + 3 * index] * (1 + 0.1 * i),
        v1[1] + normals[1 + 3 * index] * (1 + 0.1 * i),
        v1[2] + normals[2 + 3 * index] * (1 + 0.1 * i),
      ];

      project_line(v1, v2, mat_projection, i);
    }
  }


  // ------------ mouse ------------------


  const Mouse = {
    event: null,
    coordinates: [-1, -1],

    onmouseup(e) {
      this.event = null;

    },
    onmousedown(e) {
      this.event = e;
      //player_x++;
    },
    onmousemove(e) {
      this.coordinates[0] = e.clientX - bounding_client_rect.x;
      this.coordinates[1] = e.clientY - bounding_client_rect.y;

      if (this.event) {
        const dx = e.clientX - this.event.clientX;
        const dy = e.clientY - this.event.clientY;
        //camera_rotation[0] += +dy * camera_rotation_speed;
        camera_rotation[1] += +dx * camera_rotation_speed;
        //camera_rotation[2] += 0;
        this.event = e;
      }
    },
  };

  window.addEventListener('mouseup', e => Mouse.onmouseup(e), false);
  window.addEventListener('mousedown', e => Mouse.onmousedown(e), false);
  window.addEventListener('mousemove', e => Mouse.onmousemove(e), false);


  // ------------- INSTANCING ----------------
  // source: https://habr.com/ru/post/352962/



  // =============================================================================
  // TEST GL
  // =============================================================================

  const GLTEST = (function TestGL() {

    const parent = document.getElementsByClassName('graphics')[1];

    const { gl, webgl } = WebGL(screen_width, screen_height, parent);
    const ctx = Canvas(screen_width, screen_height, parent);

    const shader_program = webgl.create_shader_program(
      webgl.compile_shader(gl.VERTEX_SHADER, DATA__vertex_shader),
      webgl.compile_shader(gl.FRAGMENT_SHADER, DATA__fragment_shader),
    );

    const u_loc = webgl.define_uniform_locations(shader_program, {
      view: 'u_view',
      normal: 'u_normal',
      ambient_light: 'u_ambient_light',
      directional_light: {
        color: 'u_directional_light.color',
        direction: 'u_directional_light.direction',
      },
      offsets: 'u_offsets',
    });

    const a_loc = webgl.define_attrib_locations(shader_program, {
      coord: 'a_coord',
      color: 'a_color',
      normal: 'a_normal',
    });

    const color_array_buffer = webgl.bind_array_buffer(a_loc.color, new Float32Array(triangle.colors), 4, gl.FLOAT);
    webgl.bind_array_buffer(a_loc.coord,  new Float32Array(triangle.coordinates), 3, gl.FLOAT);
    webgl.bind_array_buffer(a_loc.normal, new Float32Array(triangle.normals),     3, gl.FLOAT);
    webgl.bind_element_buffer(new Uint16Array(triangle.indices));

    webgl.set_ambient_light(u_loc.ambient_light, [0.5, 0.5, 0.5]);
    webgl.set_directional_light(u_loc.directional_light, [1.0, 1.0, 1.0], directional_light_direction);

    const mat_projection = WebGL.ortho([], Z_NEAR, Z_FAR);

    const camera_position = [0, 0, -10];
    const camera_rotation = [-22.5 / 180 * Math.PI, Math.PI, 0];
    const camera_rotation_speed = 0.005;
    const camera_scale_scalar = 1 / 3;
    const camera_scale = [camera_scale_scalar, camera_scale_scalar, camera_scale_scalar];

    return {
      gl, webgl, ctx, u_loc, a_loc, mat_projection, camera_position, camera_rotation, camera_rotation_speed, camera_scale, color_array_buffer,
    };
  })();



  // ------------ render -----------------

  let FPS_update_timer = 0; // makes fps dump every so often
  let FPS_update_counter = 0;
  let FPS = 0;
  let old_timestamp = 0;

  function render(timestamp = 0) {
    const elapsed = timestamp - old_timestamp;
    old_timestamp = timestamp;

    // clear 2D scene
    ctx.save();
    ctx.clearRect(0, 0, screen_width, screen_height);
    ctx.lineWidth = 2;

    // fps
    FPS_update_timer += elapsed;
    FPS_update_counter++;
    if (FPS_update_timer > 500) {
      FPS = 1000 / (FPS_update_timer / FPS_update_counter) | 0;
      FPS_update_counter = 0;
      FPS_update_timer = 0;
    }
    ctx.font = '12px "Arial"';
    ctx.fillStyle = 'white';
    ctx.fillText(FPS, 0, 12);


    // push projection
    Stack.push(mat_projection);


    // sets camera
    mat4.translate(mat_projection, mat_projection, camera_position);
    mat4.rotateX(mat_projection, mat_projection, camera_rotation[0]);
    mat4.rotateY(mat_projection, mat_projection, camera_rotation[1]);
    mat4.rotateZ(mat_projection, mat_projection, camera_rotation[2]);


    // AXIS
    ctx.font = '12px "Arial"';
    ctx.lineWidth = 2;
    ctx.strokeStyle = ctx.fillStyle = 'red';
    project_line([0, 0, 0], [0.5, 0, 0], mat_projection, 'X');
    ctx.strokeStyle = ctx.fillStyle = 'green';
    project_line([0, 0, 0], [0, 0.5, 0], mat_projection, 'Y');
    ctx.strokeStyle = ctx.fillStyle = 'blue';
    project_line([0, 0, 0], [0, 0, 0.5], mat_projection, 'Z');


    // debug camera moving (camera movement inverted)
    // const sina = Math.sin(timestamp * 0.001) * 1;
    // ctx.font = '12px "Arial"';
    // ctx.strokeStyle = ctx.fillStyle = 'yellow';
    // ctx.fillText(sina, 10, 10);
    // mat4.translate(mat_projection, mat_projection, [sina, 0, 0]);


    // draw directional light direction
    ctx.fillStyle = ctx.strokeStyle = 'yellow';
    draw_vector_source(directional_light_direction, mat_projection, 5, 'LIGHT');
    project_line(directional_light_direction, [
      directional_light_direction[0] * 0.9,
      directional_light_direction[1] * 0.9,
      directional_light_direction[2] * 0.9,
    ], mat_projection);


    // unprojected mouse pos projected on screen (debug info lol)
    const mouse_pos = WebGL.unproject([], [...Mouse.coordinates, 0], [0, 0, screen_width, screen_height], mat_projection);
    ctx.fillStyle = ctx.strokeStyle = 'white';
    draw_vector_source(mouse_pos, mat_projection, 5, 'MOUSE');


    // player
    const RADIUS = 60 / camera_zoom;
    const POSX = screen_width / 2;
    const POSY = screen_height / 2 - RADIUS;
    ctx.fillStyle = 'cyan';
    ctx.beginPath();
    ctx.arc(POSX, POSY, RADIUS, 0, 2 * Math.PI);
    ctx.fill();
    const TEXT_HEIGHT = 20;
    ctx.font = `${TEXT_HEIGHT}px "Arial"`;
    ctx.fillStyle = 'black';
    const TEXT = map_get(player_x, player_y);
    ctx.fillText(map_get(player_x, player_y), POSX - ctx.measureText(TEXT).width / 2, POSY + TEXT_HEIGHT / 2.5);


    // clear 3D scene
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);



    for (let y = -(player_view_dist_y >> 1); y < +(player_view_dist_y >> 1); ++y)
      for (let x = -player_view_dist_x; x < +player_view_dist_x; ++x)
    // for (let y = 0; y < 1; ++y)
    //   for (let x = 0; x < 1; ++x)
    {
      const map_value = map_get(x + player_x, y + player_y);

      if (map_value) {
        // sets color depending on map value
        const figure_color = DATA__randomcolors[map_value];
        webgl.bind_array_buffer(
          a_loc.color,
          new Float32Array(Array(triangle.indices.length).fill(figure_color).flat()),
          4,
          gl.FLOAT,
          color_array_buffer,
        );

        // model offset
        mat4.identity(mat_modelview);
        mat4.translate(mat_modelview, mat_modelview, [
          (x + y - 1) * triangle.a / 2,
          0,
          y * triangle.h - triangle.r * ((player_x & 1) + 1),
        ]);
        if (x + player_x & 1) {
          mat4.translate(mat_modelview, mat_modelview, [triangle.a, 0, triangle.h]);
          mat4.rotateY(mat_modelview, mat_modelview, Math.PI);
        }

        // draw
        gl.uniformMatrix4fv(u_loc.view, false, mat4.multiply([], mat_projection, mat_modelview));
        gl.uniformMatrix4fv(u_loc.normal, false, mat4.transpose([], mat4.invert([], mat_modelview)));
        gl.drawElements(gl.TRIANGLES, triangle.indices.length, gl.UNSIGNED_SHORT, 0);
      }
    }


    // pop projection
    Stack.pop(mat_projection);


    // request redraw
    ctx.restore();



    // =============================================================================
    // GL TEST
    // =============================================================================


    GLTEST.camera_rotation[1] += elapsed * 0.001;

    GLTEST.ctx.save();
    GLTEST.ctx.clearRect(0, 0, screen_width, screen_height);
    GLTEST.ctx.lineWidth = 2;

    Stack.push(GLTEST.mat_projection);

    mat4.translate(GLTEST.mat_projection, GLTEST.mat_projection, GLTEST.camera_position);
    mat4.rotateX(GLTEST.mat_projection, GLTEST.mat_projection, GLTEST.camera_rotation[0]);
    mat4.rotateY(GLTEST.mat_projection, GLTEST.mat_projection, GLTEST.camera_rotation[1]);
    mat4.rotateZ(GLTEST.mat_projection, GLTEST.mat_projection, GLTEST.camera_rotation[2]);
    mat4.scale(GLTEST.mat_projection, GLTEST.mat_projection, GLTEST.camera_scale);

    GLTEST.ctx.lineWidth = 2;
    GLTEST.ctx.font = '12px "Arial"';
    const AXISLEN = 0.5;
    GLTEST.ctx.strokeStyle = GLTEST.ctx.fillStyle = 'red';
    project_line([0, 0, 0], [AXISLEN, 0, 0], GLTEST.mat_projection, 'X', GLTEST.ctx);
    GLTEST.ctx.strokeStyle = GLTEST.ctx.fillStyle = 'green';
    project_line([0, 0, 0], [0, AXISLEN, 0], GLTEST.mat_projection, 'Y', GLTEST.ctx);
    GLTEST.ctx.strokeStyle = GLTEST.ctx.fillStyle = 'blue';
    project_line([0, 0, 0], [0, 0, AXISLEN], GLTEST.mat_projection, 'Z', GLTEST.ctx);


    GLTEST.ctx.fillStyle = GLTEST.ctx.strokeStyle = 'yellow';
    draw_vector_source(directional_light_direction, GLTEST.mat_projection, 5, 'LIGHT', GLTEST.ctx);
    project_line(directional_light_direction, [
      directional_light_direction[0] * 0.9,
      directional_light_direction[1] * 0.9,
      directional_light_direction[2] * 0.9,
    ], GLTEST.mat_projection, '', GLTEST.ctx);

    GLTEST.gl.clear(GLTEST.gl.COLOR_BUFFER_BIT | GLTEST.gl.DEPTH_BUFFER_BIT);

    // for (let y = -(player_view_dist_y >> 1); y < +(player_view_dist_y >> 1); ++y)
    //   for (let x = -player_view_dist_x; x < +player_view_dist_x; ++x)
    for (let y = -1; y < +2; ++y)
      for (let x = -2; x < +3; ++x)
    {
      const map_value = map_get(x + player_x, y + player_y);

      if (map_value) {
        const figure_color = DATA__randomcolors[map_value];
        GLTEST.webgl.bind_array_buffer(GLTEST.a_loc.color, new Float32Array(Array(triangle.indices.length).fill(figure_color).flat()), 4, GLTEST.gl.FLOAT, GLTEST.color_array_buffer);

        mat4.identity(mat_modelview);
        mat4.translate(mat_modelview, mat_modelview, [
          (x + y - 1) * triangle.a / 2,
          0,
          y * triangle.h - triangle.r * ((player_x & 1) + 1),
        ]);
        if (x + player_x & 1) {
          mat4.translate(mat_modelview, mat_modelview, [triangle.a, 0, triangle.h]);
          mat4.rotateY(mat_modelview, mat_modelview, Math.PI);
        }

        GLTEST.gl.uniformMatrix4fv(GLTEST.u_loc.view, false, mat4.multiply([], GLTEST.mat_projection, mat_modelview));
        GLTEST.gl.uniformMatrix4fv(GLTEST.u_loc.normal, false, mat4.transpose([], mat4.invert([], mat_modelview)));
        GLTEST.gl.drawElements(GLTEST.gl.TRIANGLES, triangle.indices.length, GLTEST.gl.UNSIGNED_SHORT, 0);
      }
    }

    Stack.pop(GLTEST.mat_projection);
    GLTEST.ctx.restore();














    requestAnimationFrame(render);
  }


  return {
    render,
  }
}


Graphics.create_triangle = function() {
  const a = 2.0;
  const h = a * (3 ** 0.5) / 2;
  const r = a * (3 ** 0.5) / 6;
  const z = -0.1;

  const center_reversed = [0, z, h - r];
  const center_actual = [a / 2, z, r];
  const center_block = [a / 4, z, a * (3 ** 0.5) / 4];

  const coordinates_set = [
    0, 0, 0,   a, 0, 0,   a / 2, 0, h,
    0, z, 0,   a, z, 0,   a / 2, z, h,
  ];

  const indices_set = [
    0, 2, 1,          // triangle
    3, 0, 1, 1, 4, 3, // front corner
    4, 1, 2, 2, 5, 4, // right corner
    5, 2, 0, 0, 3, 5, // left corner
  ];

  const coordinates = [];

  for (let i = 0; i < indices_set.length; ++i) {
    coordinates.push(
      coordinates_set[0 + 3 * indices_set[i]],
      coordinates_set[1 + 3 * indices_set[i]],
      coordinates_set[2 + 3 * indices_set[i]],
    );
  }

  const normals = [];

  for (let i = 0; i < coordinates.length; ) {
    const normal = WebGL.create_face_normal(
      coordinates[i++], coordinates[i++], coordinates[i++],
      coordinates[i++], coordinates[i++], coordinates[i++],
      coordinates[i++], coordinates[i++], coordinates[i++],
    );
    normals.push(...normal, ...normal, ...normal);
  }

  // prints normals
  // console.log(Array(normals.length / 3).fill().map((_, i) => [normals[0 + 3 * i], normals[1 + 3 * i], normals[2 + 3 * i]]));

  return {
    coordinates,
    normals,
    indices: Array(indices_set.length).fill().map((_, i) => i),
    colors: Array(indices_set.length).fill([1.0, 0.0, 0.0, 1.0,   0.0, 1.0, 0.0, 1.0,    0.0, 0.0, 1.0, 1.0]).flat(),

    center_reversed,
    center_actual,
    center_block,

    a, h, r, z,
  };
}



Graphics.create_MDN_cube = function() {
  // source: https://github.com/mdn/webgl-examples/blob/gh-pages/tutorial/sample7/webgl-demo.js

  const coordinates = [
    // Front face
    -1.0, -1.0,  1.0,
     1.0, -1.0,  1.0,
     1.0,  1.0,  1.0,
    -1.0,  1.0,  1.0,

    // Back face
    -1.0, -1.0, -1.0,
    -1.0,  1.0, -1.0,
     1.0,  1.0, -1.0,
     1.0, -1.0, -1.0,

    // Top face
    -1.0,  1.0, -1.0,
    -1.0,  1.0,  1.0,
     1.0,  1.0,  1.0,
     1.0,  1.0, -1.0,

    // Bottom face
    -1.0, -1.0, -1.0,
     1.0, -1.0, -1.0,
     1.0, -1.0,  1.0,
    -1.0, -1.0,  1.0,

    // Right face
     1.0, -1.0, -1.0,
     1.0,  1.0, -1.0,
     1.0,  1.0,  1.0,
     1.0, -1.0,  1.0,

    // Left face
    -1.0, -1.0, -1.0,
    -1.0, -1.0,  1.0,
    -1.0,  1.0,  1.0,
    -1.0,  1.0, -1.0,
  ];


  const normals = [
    // Front
     0.0,  0.0,  1.0,
     0.0,  0.0,  1.0,
     0.0,  0.0,  1.0,
     0.0,  0.0,  1.0,

    // Back
     0.0,  0.0, -1.0,
     0.0,  0.0, -1.0,
     0.0,  0.0, -1.0,
     0.0,  0.0, -1.0,

    // Top
     0.0,  1.0,  0.0,
     0.0,  1.0,  0.0,
     0.0,  1.0,  0.0,
     0.0,  1.0,  0.0,

    // Bottom
     0.0, -1.0,  0.0,
     0.0, -1.0,  0.0,
     0.0, -1.0,  0.0,
     0.0, -1.0,  0.0,

    // Right
     1.0,  0.0,  0.0,
     1.0,  0.0,  0.0,
     1.0,  0.0,  0.0,
     1.0,  0.0,  0.0,

    // Left
    -1.0,  0.0,  0.0,
    -1.0,  0.0,  0.0,
    -1.0,  0.0,  0.0,
    -1.0,  0.0,  0.0
  ];

  const indices = [
    0,  1,  2,      0,  2,  3,    // front
    4,  5,  6,      4,  6,  7,    // back
    8,  9,  10,     8,  10, 11,   // top
    12, 13, 14,     12, 14, 15,   // bottom
    16, 17, 18,     16, 18, 19,   // right
    20, 21, 22,     20, 22, 23,   // left
  ];

  const colors = Array(indices.length).fill([1.0, 0.0, 0.0, 1.0,   0.0, 1.0, 0.0, 1.0,    0.0, 0.0, 1.0, 1.0]).flat();


  return {

    coordinates,
    normals,
    indices,
    colors,

  }
}