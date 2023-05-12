/* global XR8 */
/* global THREE */
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import testVert from "./shaders/test.vert";
import composite from "./shaders/composit.frag";
import { blazeHandsDetectionPipelineModule } from "./blazeHandsDetection.js";

let segmentCanvasTexture;
let shaderPass;
let cameraTexture;
let cameraTextureCopyPosition;

let centerXdata, centerYdata, forward, palmopen;

let surface  // Transparent surface for raycasting for object placement.
let swirl;
let swirlTexture;
let swirl_counter = 0;

let pillar1;
let pillar1Texture;
let pillar1_counter = 0;

let pillar2;
let pillar2Texture;
let pillar2_counter = 0;

let ground;

let mainScene;

let hit;

const particleMaterial = new THREE.SpriteMaterial({
  color: 0x007eff,
  map: new THREE.TextureLoader().load("img/particle.png"),
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

let particleEmitter;

export class Particle extends THREE.Sprite {
  _counter = 0;
  _velocity = new THREE.Vector3();

  _material;

  /**
   * コンストラクターです。
   * @constructor
   */
  constructor() {
    super(particleMaterial.clone());
    this._reset();
  }

  _reset() {
    const radian = Math.random() * Math.PI * 2;
    const x = Math.cos(radian) * 2;
    const z = Math.sin(radian) * 2;

    this.position.set(this.random(-0.03, 0.03), 0, this.random(-0.03, 0.03));
    this.scale.set(0.001, 0.001, 0.001);
    this._velocity.set(
      this.random(-0.015, 0.015),
      this.random(0.05, 0.1),
      this.random(-0.015, 0.015)
    );
    //this.particleMaterial.opacity = 1;
  }

  random(min, max) {
    return Math.random() * (max - min) + min;
  }

  update(speedRate) {
    this._counter += speedRate;
    this.position.add(this._velocity.clone());
    //this.particleMaterial.opacity -= 0.009;
    const rad = Math.sin((this._counter * 30 * Math.PI) / 18000);
    const scale = 0.001 + rad;
    this.scale.set(scale, scale, scale);
    if (this.position.y >= 1) {
      this._reset();
    }
  }
}


export class ParticleEmitter extends THREE.Object3D {
  _counter = 0;
  _pool = [];
  _particleNum= 50;
  _interval = 3;

  /**
   * コンストラクターです。
   * @constructor
   */
  constructor() {
    super();
  }

  update(speedRate) {
    this._counter += speedRate;
    const length = this._pool.length;
    for (let i = 0; i < length; i++) {
      const particle = this._pool[i];
      particle.update(speedRate);
    }

    if (Math.round(this._counter) % this._interval == 0) {
      this._addParticle();
    }
  }

  _hideParticle(){
    const length = this._pool.length;
    for (let i = 0; i < length; i++) {
      const particle = this._pool[i];
      particle.visible = false;
    }
  }

  _showParticle(){
    const length = this._pool.length;
    for (let i = 0; i < length; i++) {
      const particle = this._pool[i];
      particle.visible = true;
    }
  }

  _addParticle() {
    if (this._pool.length >= this._particleNum) {
      return;
    }
    const particle = new Particle();
    this._pool.push(particle);
    //scene.add(particle);
    mainScene.add(particle);
  }
}

export class Spark extends THREE.Object3D {
  /** メッシュ */
  _mesh;

  /** スピード */
  _speed= Math.random() * 0.2 + 0.1;
  /** 透明度 */
  _opacity = 0.5;

  /**
   * コンストラクター
   */
  constructor() {
    super();

    // ジオメトリ

    // カラーマップ
    const loader = new THREE.TextureLoader();
    const map = loader.load("img/Burst01.png");
    map.wrapS = map.wrapT = THREE.RepeatWrapping;

    // マテリアル
    const material = new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: this._opacity,
    });

    // メッシュ
    this._mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 2), material);
    this._mesh.position.y = Math.random() * 5;
    this._mesh.rotation.y = Math.random() * 2;
    //this._mesh.scale.set(0.1, 0.1, 0.1);
    this.add(this._mesh);
  }

  _time= 0;
  
  /**
   * フレーム毎の更新
   */
  update() {
    const time = performance.now() - this._time;
    const speedRatio = time / 16;

    // 毎フレーム少しずつ移動し透明に近づける。
    const m = this._mesh.material;
    m.opacity -= 0.01 * speedRatio;
    this._mesh.position.y -= this._speed * speedRatio;
    // 透明度が0以下だったら位置と透明度を初期化する。
    if (this._mesh.position.y < 0 || m.opacity < 0) {
      this._mesh.position.y = 8;
      m.opacity = this._opacity;
    }
    this._time = performance.now();
  }
}

let sparkEmitter;
export class SparkEmitter extends THREE.Object3D {
  /** スパークリスト */
  _sparkList = [];
  /** スパークの数 */
  _sparkNum = 150;

  /**
   * コンストラクター
   * @constructor
   */
  constructor() {
    super();

    const perAngle = 360 / this._sparkNum;
    for (let i = 0; i < this._sparkNum; i++) {
      const rad = (perAngle * i * Math.PI) / 180;
      const spark = new Spark();
      spark.rotation.x = 360 * Math.sin(rad);
      spark.rotation.z = rad;
      mainScene.add(spark);
      this._sparkList.push(spark);
    }
  }

  _hideParticle(){
    this._sparkList.forEach((spark) => {
      spark.visible = false;
    });
  }

  _showParticle(){
    this._sparkList.forEach((spark) => {
      spark.visible = true;
    });
  }

  /**
   * フレーム毎の更新
   */
  update() {
    this._sparkList.forEach((spark) => {
      spark.update();
    });
  }
}

export class Flare extends THREE.Object3D {
  /** カラーマップ */
  _map;
  /** オフセット */
  _offset = new THREE.Vector2();

  /** ランダム係数 */
  _randomRatio = Math.random() + 1;

  /**
   * コンストラクター
   */
  constructor() {
    super();

    // 上面の半径
    const topRadius = 0.6;
    // 下面の半径
    const bottomRadius = 0.2;
    // ドーナツの太さ
    const diameter = topRadius - bottomRadius;

    // ジオメトリ
    const geometry = new THREE.CylinderGeometry(
      topRadius,
      bottomRadius,
      0,
      30,
      3,
      true
    );

    // カラーマップ
    const loader = new THREE.TextureLoader();
    this._map = loader.load("img/aura3_type2.png");
    this._map.wrapS = this._map.wrapT = THREE.RepeatWrapping;
    this._map.repeat.set(10, 10);

    // マテリアル
    const material = this._createMaterial(bottomRadius, diameter);

    // メッシュ
    const mesh = new THREE.Mesh(geometry, material);
    this.add(mesh);
  }

  /**
   * マテリアルを生成します。
   * @param bottomRadius 下面の半径
   * @param diameter ドーナツの太さ
   * @private
   */
  _createMaterial(
    bottomRadius,
    diameter
  ) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        map: {
          type: "t",
          value: this._map,
        },
        offset: {
          type: "v2",
          value: this._offset,
        },
        opacity: {
          type: "f",
          value: 0.15,
        },
        innerRadius: {
          type: "f",
          value: bottomRadius,
        },
        diameter: {
          type: "f",
          value: diameter,
        },
      },
      // language=GLSL
      vertexShader: `
        varying vec2 vUv;       // フラグメントシェーダーに渡すUV座標
        varying float radius;   // フラグメントシェーダーに渡す半径
        uniform vec2 offset;    // カラーマップのズレ位置

        void main()
        {
          // 本来の一からuvをずらす
          vUv = uv + offset;
          // 中心から頂点座標までの距離
          radius = length(position);
          // 3次元上頂点座標を画面上の二次元座標に変換(お決まり)
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      // language=GLSL
      fragmentShader: `
        uniform sampler2D map;      // テクスチャ
        uniform float opacity;      // 透明度
        uniform float diameter;     // ドーナツの太さ
        uniform float innerRadius;  // 内円の半径
        varying vec2 vUv;           // UV座標
        varying float radius;       // 中心ドットまでの距離
        const float PI = 3.1415926; // 円周率

        void main() {
          // UVの位置からテクスチャの色を取得
          vec4 tColor = texture2D(map, vUv);
          // 描画位置がドーナツの幅の何割の位置になるか
          float ratio = (radius - innerRadius) / diameter;
          float opacity = opacity * sin(PI * ratio);
          // ベースカラー
          vec4 baseColor = (tColor + vec4(0.0, 0.0, 0.3, 1.0));
          // 透明度を反映させる
          gl_FragColor = baseColor * vec4(1.0, 1.0, 1.0, opacity);
        }
      `,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      transparent: true,
    });
    return material;
  }

  /**
   * フレーム毎の更新
   */
  update() {
    this._offset.x = (performance.now() / 1000) * 0.2 * this._randomRatio;
    this._offset.y = (-performance.now() / 1000) * 0.8 * this._randomRatio;
  }
}

let flareEmitter;
export class FlareEmitter extends THREE.Object3D {
  /** フレアの数 */
  _flareNum = 10;
  /** フレアリスト */
  _flareList = [];

  /**
   * コンストラクター
   */
  constructor() {
    super();

    const perAngle = 360 / this._flareNum;
    for (let i = 0; i < this._flareNum; i++) {
      const rad = (perAngle * i * Math.PI) / 180;
      const flare = new Flare();
      flare.rotation.x = rad;
      flare.rotation.y = rad;
      flare.rotation.z = rad / 2;
      this.add(flare);
      this._flareList.push(flare);
    }
  }

  /**
   * フレーム毎の更新です。
   */
  update() {
    this._flareList.forEach((flare) => {
      flare.update();
    });
  }
}

let prevTime = 0;

const raycaster = new THREE.Raycaster()
const tapPosition = new THREE.Vector2()

export const setSegmentTexture = (imageBitmap) => {
  segmentCanvasTexture = new THREE.CanvasTexture(imageBitmap);
};

export const customThreejsPipelineModule = () => {
  let scene3;
  let engaged = false;
  let composer;
  cameraTextureCopyPosition = new THREE.Vector2(0, 0);

  const xrScene = () => {
    return scene3;
  };

  const tick = () => {
    const time = Date.now();
    const diffTime = time - prevTime;
    const speedRate = Math.round(diffTime / 16.667); // 60fps = 16.67ms を意図した時間の比率

    // セーブポイントの更新
    //swirl
    swirl_counter += speedRate;
    const swirl_angle = (swirl_counter * Math.PI) / 180;
    swirl.rotation.z = swirl_angle * 0.2;

    //pillar1
    pillar1_counter += speedRate;
    // this._counter = this._counter + 0.5 * speedRate;
    const pillar1_angle = (pillar1_counter * Math.PI) / 180;

    // テクスチャを上下させる
    pillar1Texture.offset.y = 0.1 + 0.2 * Math.sin(pillar1_angle * 3);
    // テクスチャを回転させる
    pillar1.rotation.y = -pillar1_angle;

    //pillar2
    pillar2_counter += speedRate;
    // this._counter = this._counter + 0.5 * speedRate;
    const pillar2_angle = (pillar2_counter * Math.PI) / 180;

    // テクスチャを上下させる
    pillar2Texture.offset.y = 0.1 + 0.2 * Math.sin(pillar2_angle * 3);
    // テクスチャを回転させる
    pillar2.rotation.y = -pillar2_angle;

    //Particle Emit
    particleEmitter.update(speedRate);

    sparkEmitter.update();

    flareEmitter.update();

    prevTime = time;
  }

  const engage = ({ canvas, canvasWidth, canvasHeight, GLctx }) => {
    if (engaged) {
      return;
    }
    centerXdata = document.getElementById("centerXdata");
    centerYdata = document.getElementById("centerYdata");
    forward =  document.getElementById("forward");
    palmopen =  document.getElementById("palmopen");
    const scene = new THREE.Scene();
    mainScene = scene;
    const camera = new THREE.PerspectiveCamera(
      60.0 /* initial field of view; will get set based on device info later. */,
      canvasWidth / canvasHeight,
      0.01,
      1000.0,
    );
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: GLctx,
      alpha: true,
      antialias: true,
    });
    renderer.autoClear = false;
    renderer.setSize(canvasWidth, canvasHeight);
    //renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene3 = { scene, camera, renderer };
    engaged = true;

    const light = new THREE.DirectionalLight(0xffffff, 1, 100)
    light.position.set(1, 4.3, 2.5)  // default
    scene.add(light)  // Add soft white light to the scene.
    //scene.add(new THREE.AmbientLight(0x404040, 5))  // Add soft white light to the scene.

    light.shadow.mapSize.width = 1024  // default
    light.shadow.mapSize.height = 1024  // default
    light.shadow.camera.near = 0.5  // default
    light.shadow.camera.far = 500  // default
    light.castShadow = true

    surface = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2, 1, 1),
      new THREE.ShadowMaterial({
        opacity: 0.5,
      })
    )
    // surface = new THREE.Mesh(
    //   new THREE.PlaneGeometry(1, 1, 1, 1),
    //   new THREE.MeshBasicMaterial( {color: 0xFFFFFF} ) 
    // )
    surface.rotateX(-Math.PI / 2)
    surface.position.set(0, 0, 0)
    surface.receiveShadow = true
    scene.add(surface)

    // 地面の光
    const groundTexture = new THREE.TextureLoader().load("img/ground.png");
    ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1, 32, 32),
      new THREE.MeshBasicMaterial({
        //color: 0x007eff,
        color: 0xffffff,
        map: groundTexture,
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
      })
    );
    ground.scale.multiplyScalar(1.35);
    ground.rotation.x = (90 * Math.PI) / 180;
    ground.position.set(0, 0.02, 0);
    scene.add(ground);

    /**
     * 地面の渦。
     */
    // テクスチャ
    swirlTexture = new THREE.TextureLoader().load("img/swirl.png");
    swirlTexture.offset.y = -0.25;
    swirlTexture.wrapS = THREE.RepeatWrapping;

    // ドーナツ
    const swirlGeometry = new THREE.TorusGeometry(0.6, 0.3, 2, 100);
    const swirlMaterial = new THREE.MeshBasicMaterial({
      color: 0x007eff,
      map: swirlTexture,
      transparent: true,
      //wireframe: true,
      blending: THREE.AdditiveBlending,
    });
    swirl = new THREE.Mesh(swirlGeometry, swirlMaterial);
    swirl.position.y = 0.01;
    swirl.rotation.x = (90 * Math.PI) / 180;
    scene.add(swirl);

    // 光の柱1

    pillar1Texture = new THREE.TextureLoader().load("img/pillar.png");
    pillar1Texture.wrapS = THREE.RepeatWrapping;
    pillar1Texture.repeat.set(10, 1);

    const pillar1Geometry = new THREE.CylinderGeometry(
      0.3,
      0.3,
      1,
      20,
      1,
      true
    );

    const pillar1Material = new THREE.MeshBasicMaterial({
      color: 0x007eff,
      map: pillar1Texture,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });

    pillar1 = new THREE.Mesh(pillar1Geometry, pillar1Material);
    // 地面の高さに合わせる
    pillar1.position.set(0, 1 / 2, 0);
    scene.add(pillar1);

    // 光の柱2

    pillar2Texture = new THREE.TextureLoader().load("img/pillar.png");
    pillar2Texture.wrapS = THREE.RepeatWrapping;
    pillar2Texture.repeat.set(10, 1);

    const pillar2Geometry = new THREE.CylinderGeometry(
      0.8,
      0.5,
      0.25,
      20,
      1,
      true
    );

    const pillar2Material = new THREE.MeshBasicMaterial({
      color: 0x007eff,
      map: pillar2Texture,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });

    pillar2 = new THREE.Mesh(pillar2Geometry, pillar2Material);
    // 地面の高さに合わせる
    pillar2.position.set(0, 0.25 / 2, 0);
    scene.add(pillar2);

    // const cubeGeometry = new THREE.BoxGeometry( 0.5, 0.5, 0.5 ); 
    // const cubeMaterial = new THREE.MeshBasicMaterial( {color: 0x00ff00} ); 
    // const cube = new THREE.Mesh( cubeGeometry, cubeMaterial ); 
    // cube.position.set(0, 0.25, 0);
    // cube.castShadow = true;
    // scene.add( cube );

    particleEmitter = new ParticleEmitter();
    particleEmitter.position.set(2,0,0.5);
    scene.add(particleEmitter);

    sparkEmitter = new SparkEmitter();
    sparkEmitter.position.set(0,2,0);
    scene.add(sparkEmitter);

    flareEmitter = new FlareEmitter();
    flareEmitter.position.set(0,0,0);
    scene.add(flareEmitter);

    window.scene3 = scene3;
    window.XR8.Threejs.xrScene = xrScene;

    composer = new EffectComposer(renderer);

    shaderPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        segmentTexture: { value: null },
      },
      fragmentShader: composite,
      vertexShader: testVert,
    });
    composer.addPass(shaderPass);
    camera.position.set(0, 2, 2);

    // Sync the xr controller's 6DoF position and camera paremeters with our scene.
    XR8.XrController.updateCameraProjectionMatrix({
      origin: camera.position,
      facing: camera.quaternion,
    })
  };

  // This is a workaround for https://bugs.webkit.org/show_bug.cgi?id=237230
  // Once the fix is released, we can add `&& parseFloat(device.osVersion) < 15.x`
  const device = XR8.XrDevice.deviceEstimate();
  const needsPrerenderFinish =
    device.os === "iOS" && parseFloat(device.osVersion) >= 15.4;

  return {
    name: "customthreejs",
    onStart: (args) => engage(args),
    onAttach: (args) => engage(args),
    onDetach: () => {
      engaged = false;
    },
    onUpdate: ({ processCpuResult }) => {
      const realitySource =
        processCpuResult.reality || processCpuResult.facecontroller;

      if (!realitySource) {
        return;
      }

      const { rotation, position, intrinsics } = realitySource;
      const { camera } = scene3;

      for (let i = 0; i < 16; i++) {
        camera.projectionMatrix.elements[i] = intrinsics[i];
      }

      // Fix for broken raycasting in r103 and higher. Related to:
      //   https://github.com/mrdoob/three.js/pull/15996
      // Note: camera.projectionMatrixInverse wasn't introduced until r96 so check before setting
      // the inverse
      if (camera.projectionMatrixInverse) {
        if (camera.projectionMatrixInverse.invert) {
          // THREE 123 preferred version
          camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        } else {
          // Backwards compatible version
          camera.projectionMatrixInverse.getInverse(camera.projectionMatrix);
        }
      }

      if (rotation) {
        camera.setRotationFromQuaternion(rotation);
      }
      if (position) {
        camera.position.set(position.x, position.y, position.z);
      }

      // calculate tap position in normalized device coordinates (-1 to +1) for both components.
      tapPosition.x = (centerXdata.innerHTML) * 2 - 1
      tapPosition.y = -(centerYdata.innerHTML) * 2 + 1
      // Update the picking ray with the camera and tap position.
      raycaster.setFromCamera(tapPosition, camera)
      // Raycast against the "surface" object.
      const intersects = raycaster.intersectObject(surface)
      if (intersects.length === 1 && intersects[0].object === surface) {
        console.log("hit" + tapPosition.x + " " + tapPosition.y);
        hit = true;
        if(palmopen.innerHTML == "2" && forward.innerHTML == "1"){
          //hide magic
          ground.visible = false;
          pillar1.visible = false;
          pillar2.visible = false;
          swirl.visible = false;
          particleEmitter.visible = false;
          particleEmitter._hideParticle();
          sparkEmitter.visible = true;
          sparkEmitter._showParticle();
          console.log("A" + palmopen.innerHTML + " " + forward.innerHTML);
        }else if(palmopen.innerHTML == "2" && forward.innerHTML == "2"){
          //hide magic
          ground.visible = false;
          pillar1.visible = false;
          pillar2.visible = false;
          swirl.visible = false;
          particleEmitter.visible = false;
          particleEmitter._hideParticle();
          //show ball
          flareEmitter.visible = true;
          sparkEmitter.visible = true;
          sparkEmitter._showParticle();
          console.log("B" + palmopen.innerHTML + " " + forward.innerHTML);
        }else{
          //show magic
          ground.visible = true;
          pillar1.visible = true;
          pillar2.visible = true;
          swirl.visible = true;
          particleEmitter.visible = true;
          particleEmitter._showParticle();
          //hide ball
          flareEmitter.visible = false;
          sparkEmitter.visible = false;
          sparkEmitter._hideParticle();
          console.log("C" + palmopen.innerHTML + " " + forward.innerHTML);
        }
      }else{
        hit = false;
        //show magic
        ground.visible = true;
        pillar1.visible = true;
        pillar2.visible = true;
        swirl.visible = true;
        particleEmitter.visible = true;
        particleEmitter._showParticle();
        //hide ball
        flareEmitter.visible = false;
        sparkEmitter.visible = false;
        sparkEmitter._hideParticle();
        console.log("D" + palmopen.innerHTML + " " + forward.innerHTML);
      }
      //Effect Animation
      tick();
    },
    onCanvasSizeChange: ({ canvasWidth, canvasHeight }) => {
      if (!engaged) {
        return;
      }
      cameraTexture = new THREE.DataTexture(
        new Uint8Array(canvasWidth * canvasHeight * 3),
        canvasWidth,
        canvasHeight,
        THREE.RGBFormat,
      );
      const { renderer } = scene3;
      renderer.setSize(canvasWidth, canvasHeight);
    },
    onRender: () => {
      const { scene, camera, renderer } = scene3;
      // if (cameraTexture) {
      //   renderer.copyFramebufferToTexture(
      //     cameraTextureCopyPosition,
      //     cameraTexture,
      //   );
      //   console.log("Debug 3");
      // }

      renderer.clearDepth();
      // if (needsPrerenderFinish) {
      //   renderer.getContext().finish();
      //   console.log("Debug 4");
      // }
      //shaderPass.uniforms.cameraTexture = { value: cameraTexture };
      //shaderPass.uniforms.segmentTexture = { value: segmentCanvasTexture };
      //composer.render();

      renderer.render(scene, camera);
    },
    // Get a handle to the xr scene, camera and renderer. Returns:
    // {
    //   scene: The Threejs scene.
    //   camera: The Threejs main camera.
    //   renderer: The Threejs renderer.
    // }
    xrScene: () => {
      return scene3;
    },
  };
};
