/* global XR8 */
/* global THREE */

//import { Hands } from "@mediapipe/hands/hands";

// import { setSegmentTexture } from "./customThreejsPipelineModule.js";
// import { LandmarkGrid } from "@mediapipe/control_utils_3d/control_utils_3d";
// import { controls } from "@mediapipe/control_utils/control_utils";
// import { drawingUtils } from "@mediapipe/drawing_utils/drawing_utils";
// import { Pose } from "@mediapipe/pose/pose";

let hands, videoElement, outputElement, ctx, textElemnet, landmarkContainer, grid;
let processing = false;
let isDetected = "False";
let palmOpened = "Not Detected";
let palmFacing = "Not Detected";
let debug = "";
let centerX, centerY, centerZ;　//掌の中央座標

export const blazeHandsDetectionPipelineModule = () => {
  async function calcHands () {
    if (hands == null) {
      return;
    }
    await hands.send({ image: videoElement }).then(() => {
    }).catch(error => console.log(error));
  }

  return {
    name: "blazeHandsDetection",

    onStart: async ({ canvas, canvasWidth, canvasHeight }) => {
      const hoge = document.getElementsByClassName("square-box")[0];
      hoge.style.display = "block";
      textElemnet = document.getElementById("text");
      videoElement = document.getElementsByTagName("video")[0];
      //Canvasセットアップ
      outputElement = document.getElementById("draw");
      outputElement.width = canvas.clientWidth;
      outputElement.height = canvas.clientHeight;
      debug = outputElement.width + " " + outputElement.height;
      ctx = outputElement.getContext('2d');
      landmarkContainer = document.getElementsByClassName("landmark-grid-container")[0];
      grid = new LandmarkGrid(landmarkContainer, {
        connectionColor: 0xcccccc,
        definedColors: [
            { name: "Left", value: 0xffa500 },
            { name: "Right", value: 0x00ffff }
        ],
        range: 0.2,
        fitToGrid: false,
        labelSuffix: "m",
        landmarkSize: 2,
        numCellsPerAxis: 4,
        showHidden: false,
        centered: false
      });

      // 2頂点の距離の計算
      function calcDistance(p0, p1) {
        let a1 = p1.x-p0.x
        let a2 = p1.y-p0.y
        return Math.sqrt(a1*a1 + a2*a2)
      }

      // 3頂点の角度の計算
      function calcAngle(p0, p1, p2) {
        let a1 = p1.x-p0.x
        let a2 = p1.y-p0.y
        let b1 = p2.x-p1.x
        let b2 = p2.y-p1.y
        let angle = Math.acos( (a1*b1 + a2*b2) / Math.sqrt((a1*a1 + a2*a2)*(b1*b1 + b2*b2)) ) * 180/Math.PI
        return angle
      }

      // 指の角度の合計の計算
      function cancFingerAngle(p0, p1, p2, p3, p4) {
        let result = 0
        result += calcAngle(p0, p1, p2)
        result += calcAngle(p1, p2, p3)
        result += calcAngle(p2, p3, p4)
        return result
      }

      // 指ポーズの検出
      function detectFingerPose(landmarks) {
        // 指のオープン・クローズ
        let thumbIsOpen = cancFingerAngle(landmarks[0], landmarks[1], landmarks[2], landmarks[3], landmarks[4]) < 70
        let firstFingerIsOpen = cancFingerAngle(landmarks[0], landmarks[5], landmarks[6], landmarks[7], landmarks[8]) < 100
        let secondFingerIsOpen = cancFingerAngle(landmarks[0], landmarks[9], landmarks[10], landmarks[11], landmarks[12]) < 100
        let thirdFingerIsOpen = cancFingerAngle(landmarks[0], landmarks[13], landmarks[14], landmarks[15], landmarks[16]) < 100
        let fourthFingerIsOpen = cancFingerAngle(landmarks[0], landmarks[17], landmarks[18], landmarks[19], landmarks[20]) < 100

        // 掌の中央に円を描く
        centerX = (landmarks[10].x + landmarks[0].x)/2;
        centerY = (landmarks[10].y + landmarks[0].y)/2;
        centerZ = (landmarks[10].z + landmarks[0].z)/2;;
        debug = centerX +  "<br />"+ centerY + "<br />"+ centerZ;
        ctx.fillStyle = "lightskyblue";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX * outputElement.width, centerY * outputElement.height, 10, 0, Math.PI * 2, true);

        // ジェスチャー
        if (thumbIsOpen && firstFingerIsOpen && secondFingerIsOpen && thirdFingerIsOpen && fourthFingerIsOpen) {
          palmOpened = true; // 指5本オープン
          if(isDetected == "Right"){ // 右手の時に表裏判定
          if(landmarks[4].x > landmarks[0].x){
              palmFacing = "Inwards";
            }else{
              palmFacing = "Outwards";
            }
          }else{ // 左手の時に表裏判定
            if(landmarks[4].x > landmarks[0].x){
              palmFacing = "Outwards";
            }else{
              palmFacing = "Inwards";
            }
          }
        }else{
          palmOpened = "False";
          palmFacing = "False";
        }
      }

      function onResults (results) {
        processing = false;
        ctx.clearRect(0, 0, outputElement.width, outputElement.height);
        if (!results.multiHandLandmarks) {
          return;
        }
        if (results.multiHandedness[0]) { //左手右手判定
          if(results.multiHandedness[0].label == "Left"){ // Mediapipe Handsの結果は何故か左右の判定は逆になりました(要確認)
            isDetected = "Right";
          }else if(results.multiHandedness[0].label == "Right"){
            isDetected = "Left";
          }
        }
        
        if (results.multiHandLandmarks) {// 手のLandmarkを獲得
          const hand0 = results.multiHandLandmarks[0];
          const hand1 = results.multiHandLandmarks[1];
          if(hand0 != undefined){
            detectFingerPose(results.multiHandLandmarks[0]);
          }else if(hand1 != undefined){
            detectFingerPose(results.multiHandLandmarks[1]);
          }else{
            isDetected = "Not Detected";
            palmOpened = "Not Detected";
            palmFacing = "Not Detected";
          }
        } else {
          grid.updateLandmarks([]);
        }
        //テキスト表示を更新
        textElemnet.innerHTML = 
        "Detected: " + isDetected + "<br />" +
        "Palm Open: " + palmOpened + "<br />" +
        "Palm Facing: " + palmFacing + "<br />" +
        debug;

        if (results.multiHandWorldLandmarks) {
          // We only get to call updateLandmarks once, so we need to cook the data to
          // fit. The landmarks just merge, but the connections need to be offset.
          const landmarks = results.multiHandWorldLandmarks.reduce((prev, current) => [...prev, ...current], []);
          const colors = [];
          let connections = [];
          for (let loop = 0; loop < results.multiHandWorldLandmarks.length; ++loop) {
              const offset = loop * window.HAND_CONNECTIONS.length;
              const offsetConnections = window.HAND_CONNECTIONS.map((connection) => [
                  connection[0] + offset,
                  connection[1] + offset
              ]);
              connections = connections.concat(offsetConnections);
              const classification = results.multiHandedness[loop];
              colors.push({
                  list: offsetConnections.map((unused, i) => i + offset),
                  color: classification.label
              });
          }
          grid.updateLandmarks(landmarks, connections, colors);
        }else {
          grid.updateLandmarks([]);
        }
      }

      hands = new Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        },
      });
      //Mediapipe手のモデルの設定
      hands.setOptions({ 
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      hands.onResults(onResults);

    },

    onUpdate: () => {
      if (!processing) {
        processing = true;
        calcHands();
      }
    },
  };
};
