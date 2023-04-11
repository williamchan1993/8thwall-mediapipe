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
let centerX, centerY, centerZ;//掌の中央座標

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

      // 手相API関連処理
      let send_btn = document.getElementById('send');
      send_btn.addEventListener('click', SendXMLHttpRequest, false);

      // Sendボタン押下時の処理
      function SendXMLHttpRequest() {
        console.log("Pressed send button");
        var response = document.getElementById("response");
        response.innerText = "Loading";
        const canvas = document.getElementById('result');

        var dataURL = canvas.toDataURL('image/jpeg', 0.5);
        var blob = dataURItoBlob(dataURL);

        const form_data = new FormData();
        form_data.append('file', blob);

        // 通信用XMLHttpRequestを生成
        let req = new XMLHttpRequest();

        // POST形式でサーバ側の「response.php」へデータ通信を行う
        req.open("POST", "https://tesou-api.ai-game.info/eng/api/v1/analysis/left_hand");

        // トークン認証としてリクエストヘッダーを付与
        req.setRequestHeader('Authorization', 'Bearer Xf941mRmTVup5KPs60xwluOwdqQPApTSBtF1MChDJ43YTKZtzrKNgDXamJVjsmvs')
        req.send(form_data);

        // 通信が完了したらレスポンスをコンソールに出力する
        req.addEventListener('readystatechange', (r) => {
            // ここでレスポンス結果を制御する
            if (req.readyState === 4 && req.status === 200) {
              console.log("result: " + req.responseText);
                //result.innerHTML += req.responseText
              var response = document.getElementById("response");
              response.innerText = req.responseText;
            }
        });
      }

      function dataURItoBlob(dataURI) {
        // convert base64/URLEncoded data component to raw binary data held in a string
        var byteString;
        if (dataURI.split(',')[0].indexOf('base64') >= 0)
            byteString = atob(dataURI.split(',')[1]);
        else
            byteString = unescape(dataURI.split(',')[1]);
    
        // separate out the mime component
        var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    
        // write the bytes of the string to a typed array
        var ia = new Uint8Array(byteString.length);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
    
        return new Blob([ia], {type:mimeString});
    }

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
            }else{canvasResult
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
        const canvasCamera = document.getElementById('camerafeed');
        const canvasResult = document.getElementById('result');
        canvasResult.width = 602;
        canvasResult.height = 802;

        // console.log(
        //   "canvasCamera: " + canvasCamera.width + " " + canvasCamera.height + 
        //   " canvasResult: " + canvasResult.width + " " + canvasResult.height
        // );

        // Scale up canvasCamera to same size as canvasResult;
        

        const ratioX = 1; // Maintain same width
        let ch = canvasCamera.height;
        let rh = canvasResult.height;
      
        const ratioY = ch / rh;
        
        // Determine the dimensions of the cropped image
        const cropWidth = Math.min(canvasCamera.width, canvasCamera.height * ratioX / ratioY);
        const cropHeight = Math.min(canvasCamera.height, canvasCamera.width * ratioY / ratioX);
        const cropX = (canvasCamera.width - cropWidth) / 2;
        const cropY = (canvasCamera.height - cropHeight) / 2;

        canvasResult.width = 602;
        canvasResult.height = 802;

        // console.log(
        //   "cropX: " + cropX + " cropWidth: " + cropWidth +
        //   " cropY: " + cropY + " cropHeight: " + cropHeight
        // );

        var destCtx = canvasResult.getContext('2d');
        destCtx.drawImage(canvasCamera, cropX, cropY, cropWidth, cropHeight, 0, 0, 602, 802);
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
