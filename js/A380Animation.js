import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

var jeepGlb = 'assets/Jeep_00.glb';	 // Willys MB 全長 3.35

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
var mainObj;
var gui;
var partsArray = new Array();
var effect;

var bGround = true;  // Ground を表示するのか(jeep含む)
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

//function init()
var init = () =>
{
	scene = new THREE.Scene();
	clock = new THREE.Clock();

	// create a render, sets the background color and the size
	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setClearColor( 0xeeeeee, 1.0 );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1;
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

	effect = new OutlineEffect( renderer );
	effect.enabled = true;

	// view の定義
	const views = [ 'View00', 'View01', 'View02', 'View03' ];
	var viewArray = new Array();
	viewArray[ 0 ] = new PosTo();
	viewArray[ 1 ] = new PosTo();
	viewArray[ 2 ] = new PosTo();
	viewArray[ 3 ] = new PosTo();
	viewArray[ 0 ].position = new THREE.Vector3( 27.5, 27.6, 6.7 );
	viewArray[ 0 ].lookAt = new THREE.Vector3( 3.7, -0.5, -2.0 );
	viewArray[ 1 ].position = new THREE.Vector3( 0.355, 0.395, 2.153 );
	viewArray[ 1 ].lookAt = new THREE.Vector3( -0.4449, 0.403, 0.009 );
	viewArray[ 2 ].position = new THREE.Vector3( -1.637, 1.560, 0.776 );
	viewArray[ 2 ].lookAt = new THREE.Vector3( -0.313, 0.774, -0.093 );
	viewArray[ 3 ].position = new THREE.Vector3( -1.637, 1.560, 0.776 );
	viewArray[ 3 ].lookAt = new THREE.Vector3( -0.313, 0.774, -0.093 );

	// create a camera, which defines where we're looking at.
	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 1000 );
	camera.position.x = viewArray[ 0 ].position.x;
	camera.position.y = viewArray[ 0 ].position.y;
	camera.position.z = viewArray[ 0 ].position.z;

	camera.lookAt( scene.position );

	// Camera Mouse Control
	camControl = new OrbitControls( camera, renderer.domElement );
	camControl.rotateSpeed = 4;

	// create the ground plane
	var planeGeometry = new THREE.PlaneGeometry( 60, 40, 18, 12 );

	var material1 = new THREE.MeshLambertMaterial( { color: 0xddffff } );
	var material2 = new THREE.MeshBasicMaterial( { color: 0x333333, wireframe: true } );
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
	var cubeSize = Math.ceil( ( Math.random() * 3 ) );
	var cubeGeometry = new THREE.BoxGeometry( cubeSize, cubeSize, cubeSize );
	var cubeMaterial = new THREE.MeshLambertMaterial( { color: Math.random() * 0xffffff } );
	var cube = new THREE.Mesh( cubeGeometry, cubeMaterial );
	cube.castShadow = true;
	cube.name = "cube-" + scene.children.length;

	// position the cube randomly in the scene
	cube.position.x = -20;
	cube.position.y = 2;
	cube.position.z = 10;

	// add the cube to the scene
	scene.add( cube );

	// 読み込んだシーンが暗いので明るくする(していたが、意味が無くなった。)
	// 明るくしたいのなら RenderPass を使えとのこと
	renderer.outputColorSpace = THREE.SRGBColorSpace;

	// add subtle ambient lighting
	var ambientLight = new THREE.AmbientLight( 0xffffff );
	scene.add( ambientLight );

	// 並行光源の追加
	const dirLight1 = new THREE.DirectionalLight( 0xffffff );
	dirLight1.position.set( 20, 20, 25 );
	dirLight1.castShadow = true;
	dirLight1.shadow.camera.top = 50;
	dirLight1.shadow.camera.bottom = -25;
	dirLight1.shadow.camera.left = -25;
	dirLight1.shadow.camera.right = 25;
	dirLight1.shadow.camera.near = 0.1;
	dirLight1.shadow.camera.far = 200;
	dirLight1.shadow.mapSize.set( 2048, 2048 );
	scene.add( dirLight1 );

	const dirLight2 = new THREE.DirectionalLight( 0xffffff );
	dirLight2.position.set( -20, -20, 25 );
	scene.add( dirLight2 );

	var onProgress = function ( xhr )
	{
		if ( xhr.lengthComputable )
		{
			var percentComplete = xhr.loaded / xhr.total * 100;
		}
		else
		{
			var percentComplete = xhr.loaded / glbSize * 100;
		}
		loadProgress.value = percentComplete;
	};

	// gltf ファイルの読み込み
	var loader = new GLTFLoader();
	loader.load( mainGlb, function ( data )
	{
		const gltf = data;
		mainObj = gltf.scene;
		animations = gltf.animations;
		mainObj.scale.set( mainScale, mainScale, mainScale );
		mainObj.position.set( mainX, mainY, mainZ );

		// アニメーションスタート
		controls.Restart();

		// 影を持つ
		mainObj.traverse( function ( child )
		{
			child.castShadow = true;
		} );

		scene.add( mainObj );

		// children の名前で変数を追加し、checkbox で登録する
		for ( let i = 0; i < mainObj.children.length; i++ )
		{
			partsArray.push( mainObj.children[ i ].name );
		}

		window.addEventListener( 'resize', onWindowResize );

		// Hide Progress Bar
		progressDiv.style.display = 'none';
	}, onProgress );

	// 比較用 Jeep
	loader.load( jeepGlb, function ( data )
	{
		const gltf = data;
		jeepScene = gltf.scene;

		jeepScene.scale.set( jeepScale, jeepScale, jeepScale ); // Willys MB 全長 3.35
		jeepScene.position.set( jeepX, jeepY, jeepZ );

		// 影を持つ
		jeepScene.traverse( function ( child )
		{
			child.castShadow = true;
		} );

		scene.add( jeepScene );
	} );

	controls = new function ()
	{
		this.OutLine = true;
		this.CastShadow = true;
		this.GroundPlane = true;

		this.View = 'View00';

		this.RemoveCube = function ()
		{
			var allChildren = scene.children;
			var lastObject = allChildren[ allChildren.length - 1 ];
			if ( lastObject instanceof THREE.Mesh )
			{
				scene.remove( lastObject );
			}
		};

		this.AddCube = function ()
		{
			var cubeSize = Math.ceil( ( Math.random() * 3 ) );
			var cubeGeometry = new THREE.BoxGeometry( cubeSize, cubeSize, cubeSize );
			var cubeMaterial = new THREE.MeshLambertMaterial( { color: Math.random() * 0xffffff } );
			var cube = new THREE.Mesh( cubeGeometry, cubeMaterial );
			cube.castShadow = true;
			cube.name = "cube-" + scene.children.length;

			// position the cube randomly in the scene
			cube.position.x = -30 + Math.round( ( Math.random() * planeGeometry.parameters.width ) );
			cube.position.y = Math.round( ( Math.random() * 5 ) );
			cube.position.z = -20 + Math.round( ( Math.random() * planeGeometry.parameters.height ) );

			// add the cube to the scene
			scene.add( cube );
		};

		this.ViewPosition = function ()
		{
			alert( 'CamPosition x:' + camera.position.x.toFixed( 3 )
				+ ' y: ' + camera.position.y.toFixed( 3 )
				+ ' z: ' + camera.position.z.toFixed( 3 ) + '\r\n'
				+ 'Lookat x: ' + camControl.target.x.toFixed( 3 )
				+ ' y: ' + camControl.target.y.toFixed( 3 )
				+ ' z: ' + camControl.target.z.toFixed( 3 ) );
		};

		this.Restart = function ()
		{
			if ( animations && animations.length )
			{
				// Animation Mixerインスタンスを生成
				mixer = new THREE.AnimationMixer( mainObj );

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
	};

	gui = new dat.GUI();
	// states
	const viewCtrl = gui.add( controls, 'View' ).options( views );
	gui.add( controls, 'ViewPosition' );
	gui.add( controls, 'OutLine' ).onChange( setOutLine );
	gui.add( controls, 'CastShadow' ).onChange( setCastShadow );
	gui.add( controls, 'GroundPlane' ).onChange( setGroundPlane );

	viewCtrl.onChange( function ()
	{
		var idx = views.indexOf( controls.View );
		camControl.up0.set( 0, 1, 0 ); // set a new up vector
		camControl.reset();
		camControl.object.position.set( viewArray[ idx ].position.x,
			viewArray[ idx ].position.y,
			viewArray[ idx ].position.z );
		camControl.target = new THREE.Vector3( viewArray[ idx ].lookAt.x,
			viewArray[ idx ].lookAt.y, viewArray[ idx ].lookAt.z );
	} );

	function setCastShadow()
	{
		mainObj.traverse( function ( child ) { child.castShadow = controls.CastShadow; } );
		jeepObj.traverse( function ( child ) { child.castShadow = controls.CastShadow; } );
	}

	function setGroundPlane()
	{
		bGround = controls.GroundPlane;
		visibleGround();
	}

	function setOutLine()
	{
		effect.enabled = controls.OutLine;
	}

	function onWindowResize()
	{
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		effect.setSize( window.innerWidth, window.innerHeight );
	}

	render();
}

function render()
{
	effect.render( scene, camera );

	camControl.update();
	requestAnimationFrame( render );

	visibleGround();

	// Animation Mixerを実行
	if ( mixer )
	{
		mixer.update( clock.getDelta() );
		// スライダー位置を変更する
		for ( let i = 0; i < nAnim; i++ )
		{
			if ( actions[ i ].paused === false )
			{
				sliders[ i ].value = actions[ i ].time * 30;
			}
		}
	}
}

// 視線ベクトルが上（上空）を向いた場合は地面を消す
var visibleGround = () =>
{
	if ( bGround && camControl.target.y < camera.position.y )
	{
		groundPlane1.visible = true;
		groundPlane2.visible = true;
		jeepScene.visible = true;
	}
	else
	{
		groundPlane1.visible = false;
		groundPlane2.visible = false;
		jeepScene.visible = false;
	}
}

//function changeTex( nTex )
var changeTex = ( nTex ) =>
{
	let texImage;
	switch ( nTex )
	{
		case 1:
			texImage = "assets/texture/A380-01.png";
			break;
		case 2:
			texImage = "assets/texture/A380-02.png";
			break;
		case 3:
			texImage = "assets/texture/A380-03.png";
			break;
		case 4:
			texImage = "assets/texture/A380-04.png";
			break;
	}
	var object = mainObj.getObjectByName( "Body" ); // find obj by name

	object.material.map = new THREE.TextureLoader().load( texImage );
	object.material.map.colorSpace = "srgb";
	object.material.map.flipY = false;
	object.material.needsUpdate = true; // necessary
}
export { changeTex }; // これが無いと HTML 側から呼び出せない

window.onSlider = ( iAnim, val ) =>
{
	actions[ iAnim ].paused = true;
	actions[ iAnim ].time = val / 30;
}

window.onPlay = ( iAnim ) =>
{
	actions[ iAnim ].paused = false;
	actions[ iAnim ].timeScale = 1;
}

window.onReverse = ( iAnim ) =>
{
	actions[ iAnim ].paused = false;
	actions[ iAnim ].timeScale = -1;
}

window.onload = init;
