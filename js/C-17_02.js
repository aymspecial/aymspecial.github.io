import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CreaseSilhouetteMesh } from './CreaseSilhouetteMesh.js';

var jeepGlb = 'assets/Jeep_00.glb';	 // Willys MB 全長 3.35
var jeepPosition = new THREE.Vector3( jeepPositionX, jeepPositionY, jeepPositionZ );
                                                                 
// アニメーション
const nAnim = 1;
var animations;
var controls;
var sliders = new Array( nAnim );
var animNames = new Array( nAnim );
var actions = new Array( nAnim );
var loadProgress;
var progressDiv;

// global variables
var renderer;
var scene;
var camera;
var camControl;
var mixer;
var clock;
var container;
var obj;
var gui;
var partsArray = new Array();
var effect;

var bGroundPlane = true;
var groundPlane1;
var groundPlane2;
var jeepScene;

class PosTo
{
	constructor()
	{
		this.position = new THREE.Vector3( 0, 0, 0 );
		this.lookAt = new THREE.Vector3( 0, 0, 0 );
	}
}

async function main()
{
	init();
}

Promise.resolve().then( main );

const init = () =>
{
	scene = new THREE.Scene();
	clock = new THREE.Clock();

	// create a render, sets the background color and the size
	renderer = new THREE.WebGLRenderer( {
		antialias: true,
		alpha: true,
	} );
	renderer.setClearColor( 0xeeeeee, 1.0 );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.shadowMap.enabled = true;

	// Renderer と Div の関連付け
	container = document.getElementById( 'webgl-div' );
	document.body.appendChild( container );
	container.appendChild( renderer.domElement );
	for ( let i = 0; i < nAnim; i++ )
	{
		sliders[ i ] = document.getElementById( 'slide' + ( '00' + i ).slice( -2 ) );
		animNames[ i ] = document.getElementById( 'animName' + ( '00' + i ).slice( -2 ) );
	}
	loadProgress = document.getElementById( 'loadProgress' );
	progressDiv = document.getElementById( 'progressDiv' );

	effect = renderer;
	effect.enabled = true;

	// view の定義
	const views = [ 'View00', 'View01', 'View02', 'View03' ];
	var viewArray = new Array();
	viewArray[ 0 ] = new PosTo();
	viewArray[ 1 ] = new PosTo();
	viewArray[ 2 ] = new PosTo();
	viewArray[ 3 ] = new PosTo();
	viewArray[ 0 ].position = new THREE.Vector3( 36.5, 30.1, 55.9 );
	viewArray[ 0 ].lookAt = new THREE.Vector3( -1.3, 3.58, -0.18 );
	viewArray[ 1 ].position = new THREE.Vector3( -1.65, 2.664, 5.8 );
	viewArray[ 1 ].lookAt = new THREE.Vector3( 3.02, 1.15, -0.588 );
	viewArray[ 2 ].position = new THREE.Vector3( 5.49, 4.42, 18.16 );
	viewArray[ 2 ].lookAt = new THREE.Vector3( 0.0, 1.32, 12.486 );

	// create a camera, which defines where we're looking at.
	camera = new THREE.PerspectiveCamera(
		30,
		window.innerWidth / window.innerHeight,
		1.0,
		1000,
	);
	camera.position.x = viewArray[ 0 ].position.x;
	camera.position.y = viewArray[ 0 ].position.y;
	camera.position.z = viewArray[ 0 ].position.z;

	camera.lookAt( scene.position );

	// Camera Mouse Control
	camControl = new OrbitControls( camera, renderer.domElement );
	camControl.rotateSpeed = 0.5;

	// create the ground plane
	var planeGeometry = new THREE.PlaneGeometry( 60, 40, 18, 12 );

	var material1 = new THREE.MeshLambertMaterial( { color: 0xddffff } );
	var material2 = new THREE.MeshBasicMaterial( {
		color: 0x333333,
		wireframe: true,
	} );
	groundPlane1 = new THREE.Mesh( planeGeometry, material1 );
	groundPlane2 = new THREE.Mesh( planeGeometry, material2 );
	groundPlane1.name = 'ground';
	groundPlane2.name = 'groundLine';
	groundPlane1.receiveShadow = true;

	// rotate and position the plane
	groundPlane1.rotation.x = -0.5 * Math.PI;
	groundPlane1.position.x = 0;
	groundPlane1.position.y = 0;
	groundPlane1.position.z = 0;
	groundPlane2.rotation.x = -0.5 * Math.PI;
	groundPlane2.position.x = 0;
	groundPlane2.position.y = 0;
	groundPlane2.position.z = 0;

	// add the plane to the scene
	scene.add( groundPlane1 );
	scene.add( groundPlane2 );

	// Add Cube
	var cube = boxMesh();
	scene.add( cube );

	// 読み込んだシーンが暗いので明るくする
	renderer.outputColorSpace = THREE.SRGBColorSpace;

	// add subtle ambient lighting
	var ambientLight = new THREE.AmbientLight( 0xffffff );
	scene.add( ambientLight );

	// 並行光源の追加
	const dirLight1 = new THREE.DirectionalLight( 0xffffff, 2.0 );
	dirLight1.position.set( 20, 20, 25 );
	dirLight1.castShadow = true;
	dirLight1.shadow.camera.top = 50;
	dirLight1.shadow.camera.bottom = -25;
	dirLight1.shadow.camera.left = -25;
	dirLight1.shadow.camera.right = 25;
	dirLight1.shadow.camera.near = 0.01;
	dirLight1.shadow.camera.far = 100;
	dirLight1.shadow.mapSize.set( 2048, 2048 );
	scene.add( dirLight1 );

	const dirLight2 = new THREE.DirectionalLight( 0xffffff );
	dirLight2.position.set( -20, -20, 25 );
	scene.add( dirLight2 );

	var onProgress = ( xhr ) =>
	{
		if ( xhr.lengthComputable )
		{
			var percentComplete = ( xhr.loaded / xhr.total ) * 100;
		}
		else
		{
			var percentComplete = ( xhr.loaded / glbSize ) * 100;
		}
		loadProgress.value = percentComplete;
	};

	// gltf ファイルの読み込み
	var loader = new GLTFLoader();
	loader.load( glbFile, data =>
	{
		const gltf = data;
		obj = gltf.scene;

		obj.scale.set( glbScale, glbScale, glbScale );
		obj.position.x = glbPositionX;
		obj.position.y = glbPositionY;
		obj.position.z = glbPositionZ;

		animations = gltf.animations;

		// 影を持つ
		obj.traverse( child =>
		{
			child.castShadow = true;
		} );

		// ここで Mesh にだけ ThinEdgeGeometry を適用する
		obj.traverse( child =>
		{
			if ( child.isMesh && child.name != 'ThinEdgeLine' )
			{
				const wire = new CreaseSilhouetteMesh( {
					geometry: child,
					// creaseAngle: 45.0,
					// color: 0x000000,
					// linewidth: 0.5,
					// polygonOffsetFactor: -2,
					// polygonOffsetUnits: -1,
				} );
				child.add( wire );
			}
		} );

		logBoundingBox( data, glbFile );
		scene.add( obj );

		// children の名前で変数を追加し、checkbox で登録する
		for ( let i = 0; i < obj.children.length; i++ )
		{
			partsArray.push( obj.children[ i ].name );
		}

		window.addEventListener( 'resize', onWindowResize );

		// Hide Progress Bar
		progressDiv.style.display = 'none';

		// アニメーションスタート
		controls.Restart();
		render();
	}, onProgress );

	loader.load( jeepGlb, function ( data )
	{
		const gltf = data;
		jeepScene = gltf.scene;

		jeepScene.scale.set( jeepScale, jeepScale, jeepScale ); // Willys MB 全長 3.35
		jeepScene.position.copy( jeepPosition );

		// 影を持つ
		jeepScene.traverse( function ( child )
		{
			child.castShadow = true;
		} );

		logBoundingBox( data, jeepGlb );

		scene.add( jeepScene );
	} );

	controls = new ( function ()
	{
		this.OutLine = true;
		this.CastShadow = true;
		this.GroundPlane = true;
		this.Body = true;
		this.Cover = true;

		this.View = 'View00';

		this.RemoveCube = () =>
		{
			var allChildren = scene.children;
			var lastObject = allChildren[ allChildren.length - 1 ];
			if ( lastObject instanceof THREE.Mesh )
			{
				scene.remove( lastObject );
			}
		};

		this.AddCube = () =>
		{
			var cubeSize = Math.ceil( Math.random() * 3 );
			var cubeGeometry = new THREE.BoxGeometry( cubeSize, cubeSize, cubeSize );
			var cubeMaterial = new THREE.MeshLambertMaterial( {
				color: Math.random() * 0xffffff,
			} );
			var cube = new THREE.Mesh( cubeGeometry, cubeMaterial );
			cube.castShadow = true;
			cube.name = 'cube-' + scene.children.length;

			// position the cube randomly in the scene
			cube.position.x =
                    -30 + Math.round( Math.random() * planeGeometry.parameters.width );
			cube.position.y = Math.round( Math.random() * 5 );
			cube.position.z =
                    -20 + Math.round( Math.random() * planeGeometry.parameters.height );

			// add the cube to the scene
			scene.add( cube );
		};

		this.ViewPosition = () =>
		{
			alert(
				'CamPosition x:' +
                    camera.position.x.toFixed( 3 ) +
                    ' y: ' +
                    camera.position.y.toFixed( 3 ) +
                    ' z: ' +
                    camera.position.z.toFixed( 3 ) +
                    '\r\n' +
                    'Lookat x: ' +
                    camControl.target.x.toFixed( 3 ) +
                    ' y: ' +
                    camControl.target.y.toFixed( 3 ) +
                    ' z: ' +
                    camControl.target.z.toFixed( 3 ),
			);
		};

		this.Restart = () =>
		{
			if ( animations && animations.length )
			{
				// Animation Mixerインスタンスを生成
				mixer = new THREE.AnimationMixer( obj );

				// 全ての Animation Clip に対して
				for ( let i = 0; i < nAnim; i++ )
				{
					// AnimationActionを生成
					actions[ i ] = mixer.clipAction( animations[ i ] );

					sliders[ i ].max = actions[ i ]._clip.duration * 30;

					// ループ設定（1回のみ）
					actions[ i ].setLoop( THREE.LoopOnce );

					// アニメーションの最後のフレームでアニメーションが終了
					actions[ i ].clampWhenFinished = true;

					// stop した状態で開始する場合も一旦 Play を呼び出して Pause 状態にしないと
					// AnimationAction の中身が揃わない
					actions[ i ].play();
					actions[ i ].paused = true;

					animNames[ i ].innerText = actions[ i ]._clip.name;
				}
			}
		};
	} )();

	// states
	gui = new dat.GUI();
	const viewCtrl = gui.add( controls, 'View' ).options( views );
	gui.add( controls, 'ViewPosition' );
	gui.add( controls, 'OutLine' ).onChange( setOutLine );
	gui.add( controls, 'CastShadow' ).onChange( setCastShadow );
	gui.add( controls, 'GroundPlane' ).onChange( setGroundPlane );
	gui.add( controls, 'Body' ).onChange( setBody );
	gui.add( controls, 'Cover' ).onChange( setCover );

	viewCtrl.onChange( () =>
	{
		var idx = views.indexOf( controls.View );
		// camControl.up0.set( 0, 1, 0 ); // set a new up vector
		camControl.reset();
		camControl.object.position.set(
			viewArray[ idx ].position.x,
			viewArray[ idx ].position.y,
			viewArray[ idx ].position.z,
		);
		camControl.target = new THREE.Vector3(
			viewArray[ idx ].lookAt.x,
			viewArray[ idx ].lookAt.y,
			viewArray[ idx ].lookAt.z,
		);
	} );

	function setCastShadow()
	{
		obj.traverse( ( child ) =>
		{
			child.castShadow = controls.CastShadow;
		} );
	};

	function setGroundPlane()
	{
		bGroundPlane = controls.GroundPlane;
	};

	function setBody()
	{
		obj.traverse( ( child ) =>
		{
			if ( child.name == 'Body' )
				child.visible = controls.Body;
		} );
	};

	function setCover()
	{
		obj.traverse( ( child ) =>
		{
			if ( child.name == 'Cover' )
				child.visible = controls.Cover;
		} );
	};

	function setOutLine ()
	{
		obj.traverse( child =>
		{
			if ( child.name == 'ThinEdgeLine' )
				child.visible = controls.OutLine;
		} );
	};

	function boxMesh()
	{
		var cubeSize = Math.ceil( ( Math.random() * 3 ) );
		var cubeGeometry = new THREE.BoxGeometry( cubeSize, cubeSize, cubeSize );
		var cubeMaterial = new THREE.MeshLambertMaterial( { color: Math.random() * 0xffffff } );
		var cube = new THREE.Mesh( cubeGeometry, cubeMaterial );
		cube.castShadow = true;
		cube.name = 'cube-' + scene.children.length;

		// position the cube randomly in the scene
		cube.position.x = -20;
		cube.position.y = 2;
		cube.position.z = 5;

		// add the cube to the scene
		return cube;
	};

	function logBoundingBox( gltf, fileName )
	{
		const model = gltf.scene;
		scene.add( model );

		// 空のBox3オブジェクトを作成
		const box = new THREE.Box3();

		// モデルの形状（すべての子要素を含む）からバウンディングボックスを計算
		box.setFromObject( model );

		// min（最小値）とmax（最大値）を取り出す
		const min = box.min;
		const max = box.max;

		// コンソールに出力して確認！
		console.log( `Xの範囲 (minx ~ maxx): ${min.x} ~ ${max.x}` );
		console.log( `Yの範囲 (miny ~ maxy): ${min.y} ~ ${max.y}` );
		console.log( `Zの範囲 (minz ~ maxz): ${min.z} ~ ${max.z}` );

		// サイズ（幅・高さ・奥行き）を直接知りたい場合
		const size = new THREE.Vector3();
		box.getSize( size );
		console.log( `オブジェクト名: ${fileName}, 幅:${size.x}, 高さ:${size.y}, 奥行き:${size.z}` );
	};

	function onWindowResize ()
	{
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		effect.setSize( window.innerWidth, window.innerHeight );
	};
};

function viewGroundPlane( bView )
{
	groundPlane1.visible = bView;
	groundPlane2.visible = bView;
	if ( jeepScene )
		jeepScene.visible = bView;
};

function render ()
{
	requestAnimationFrame( render );

	// 視線ベクトルが上（上空）を向いた場合は地面を消す
	var bViewUp = ( camera.position.y < camControl.target.y ) ? true : false;

	if( bViewUp || !bGroundPlane )
		viewGroundPlane( false );
	else
		viewGroundPlane( true );

	// Animation Mixerを実行
	if ( mixer )
	{
		mixer.update( clock.getDelta() );
		// スライダー位置を変更する
		for ( let i = 0; i < nAnim; i++ )
		{
			if ( actions[ i ].paused === false ) //&& actions[ i ].paused == false )
			{
				sliders[ i ].value = actions[ i ].time * 30;
			}
		}
	}

	effect.render( scene, camera );
	camControl.update();
};

window.onSlider = ( iAnim, val ) =>
{
	actions[ iAnim ].paused = true;
	actions[ iAnim ].time = val / 30;
};

window.onPlay = ( iAnim ) =>
{
	actions[ iAnim ].paused = false;
	actions[ iAnim ].timeScale = 1;
};

window.onReverse = ( iAnim ) =>
{
	actions[ iAnim ].paused = false;
	actions[ iAnim ].timeScale = -1;
};

