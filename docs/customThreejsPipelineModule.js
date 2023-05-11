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

let centerXdata, centerYdata;

let surface  // Transparent surface for raycasting for object placement.

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

  const engage = ({ canvas, canvasWidth, canvasHeight, GLctx }) => {
    if (engaged) {
      return;
    }
    centerXdata = document.getElementById("centerXdata");
    centerYdata = document.getElementById("centerYdata");
    const scene = new THREE.Scene();
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
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene3 = { scene, camera, renderer };
    engaged = true;

    const light = new THREE.DirectionalLight(0xffffff, 1, 100)
    light.position.set(1, 4.3, 2.5)  // default
    scene.add(light)  // Add soft white light to the scene.
    scene.add(new THREE.AmbientLight(0x404040, 5))  // Add soft white light to the scene.

    light.shadow.mapSize.width = 1024  // default
    light.shadow.mapSize.height = 1024  // default
    light.shadow.camera.near = 0.5  // default
    light.shadow.camera.far = 500  // default
    light.castShadow = true

    // surface = new THREE.Mesh(
    //   new THREE.PlaneGeometry(1, 1, 1, 1),
    //   new THREE.ShadowMaterial({
    //     opacity: 0.5,
    //   })
    // )
    surface = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1, 1, 1),
      new THREE.MeshBasicMaterial( {color: 0xFFFFFF} ) 
    )
    surface.rotateX(-Math.PI / 2)
    surface.position.set(0, 0, 0)
    surface.receiveShadow = true
    scene.add(surface)

    // const cubeGeometry = new THREE.BoxGeometry( 0.5, 0.5, 0.5 ); 
    // const cubeMaterial = new THREE.MeshBasicMaterial( {color: 0x00ff00} ); 
    // const cube = new THREE.Mesh( cubeGeometry, cubeMaterial ); 
    // cube.position.set(0, 0.25, 0);
    // cube.castShadow = true;
    // scene.add( cube );

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
      //console.log(centerXdata.innerHTML + " " + centerYdata.innerHTML);
      //console.log("hand " + tapPosition.x + " " + tapPosition.y);
      // Update the picking ray with the camera and tap position.
      raycaster.setFromCamera(tapPosition, camera)
      // Raycast against the "surface" object.
      const intersects = raycaster.intersectObject(surface)
      if (intersects.length === 1 && intersects[0].object === surface) {
        console.log("hit" + tapPosition.x + " " + tapPosition.y);
      }
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
