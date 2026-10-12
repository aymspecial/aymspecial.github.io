import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { Wireframe } from 'three/addons/lines/Wireframe.js';

const vertexShaderSource = `
#include <common>

uniform float linewidth;
uniform vec2 resolution;

attribute vec3 instanceStart;
attribute vec3 instanceEnd;
attribute float isCrease;
attribute vec3 normalA;
attribute vec3 normalB;

out float isDraw;

void main()
{
    vec4 vp = modelViewMatrix * vec4( instanceStart, 1.0 );
    vec3 vViewDir = normalize( -vp.xyz );

    float isSilhouette = 0.0;
    if ( isCrease == 0.0 )
    {
        vec3 viewNormalA = normalize( normalMatrix * normalA );
        vec3 viewNormalB = normalize( normalMatrix * normalB );

        float d1 = dot( viewNormalA, vViewDir );
        float d2 = dot( viewNormalB, vViewDir );
        isSilhouette = ( d1 * d2 < 0.0 ) ? 1.0 : 0.0;
    }

    if ( isCrease == 0.0 && isSilhouette == 0.0 )
    {
        gl_Position = projectionMatrix * vp;
        isDraw = 0.0;
        return;
    }

    isDraw = 1.0;

    float aspect = resolution.x / resolution.y;
    vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
    vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );
    vec4 clipStart = projectionMatrix * start;
    vec4 clipEnd = projectionMatrix * end;
    vec3 ndcStart = clipStart.xyz / clipStart.w;
    vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

    vec2 dir = ndcEnd.xy - ndcStart.xy;
    dir.x *= aspect;
    dir = normalize( dir );

    vec2 offset = vec2( dir.y, -dir.x );
    dir.x /= aspect;
    offset.x /= aspect;

    if ( position.x < 0.0 )
        offset *= -1.0;

    if ( position.y < 0.0 )
        offset += -dir;
    else if ( position.y > 1.0 )
        offset += dir;

    offset *= linewidth;
    offset /= resolution.y;

    vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;
    offset *= clip.w;
    clip.xy += offset;
    gl_Position = clip;
}
`;

const fragmentShaderSource = `
#include <common>

uniform vec3 diffuse;
uniform float opacity;
uniform float linewidth;

in float isDraw;

void main()
{
    if ( isDraw == 0.0 )
        discard;

    gl_FragColor = vec4( diffuse, opacity );
}
`;

const lineResolution = new THREE.Vector2( window.innerWidth, window.innerHeight );
window.addEventListener( 'resize', () =>
{
	lineResolution.set( window.innerWidth, window.innerHeight );
} );

class CreaseSilhouetteGeometry extends LineSegmentsGeometry
{
	constructor( child, creaseAngle )
	{
		super();

		const geometry = BufferGeometryUtils.mergeVertices( child.geometry );
		geometry.computeVertexNormals();
		const index = geometry.index.array;
		const posarr = geometry.attributes.position.array;

		function buildTriangles()
		{
			const triangles = [];

			if ( geometry.groups && geometry.groups.length > 0 )
			{
				geometry.groups.forEach( group =>
				{
					for ( let i = group.start; i < group.start + group.count; i += 3 )
					{
						triangles.push( [ index[ i ], index[ i + 1 ], index[ i + 2 ] ] );
					}
				} );
			}
			else
			{
				for ( let i = 0; i < index.length; i += 3 )
				{
					triangles.push( [ index[ i ], index[ i + 1 ], index[ i + 2 ] ] );
				}
			}

			return triangles;
		}

		function computeTriangleNormal( a, b, c )
		{
			const ax = posarr[ a * 3 ], ay = posarr[ a * 3 + 1 ], az = posarr[ a * 3 + 2 ];
			const bx = posarr[ b * 3 ], by = posarr[ b * 3 + 1 ], bz = posarr[ b * 3 + 2 ];
			const cx = posarr[ c * 3 ], cy = posarr[ c * 3 + 1 ], cz = posarr[ c * 3 + 2 ];

			const ab = new THREE.Vector3( bx - ax, by - ay, bz - az );
			const ac = new THREE.Vector3( cx - ax, cy - ay, cz - az );

			return new THREE.Vector3().crossVectors( ab, ac ).normalize();
		}

		function buildEdgeMap( triangles )
		{
			const map = new Map();

			const addEdge = ( a, b, triIndex ) =>
			{
				const ax = posarr[ a * 3 ], ay = posarr[ a * 3 + 1 ], az = posarr[ a * 3 + 2 ];
				const bx = posarr[ b * 3 ], by = posarr[ b * 3 + 1 ], bz = posarr[ b * 3 + 2 ];

				const A = `${ax.toFixed( 6 )},${ay.toFixed( 6 )},${az.toFixed( 6 )}`;
				const B = `${bx.toFixed( 6 )},${by.toFixed( 6 )},${bz.toFixed( 6 )}`;
				const key = A < B ? `${A}_${B}` : `${B}_${A}`;

				if ( !map.has( key ) )
					map.set( key, [] );
				map.get( key ).push( triIndex );
			};

			triangles.forEach( ( [ a, b, c ], i ) =>
			{
				addEdge( a, b, i );
				addEdge( b, c, i );
				addEdge( c, a, i );
			} );

			return map;
		}

		const triangles = buildTriangles();
		const triNormals = triangles.map( ( [ a, b, c ] ) => computeTriangleNormal( a, b, c ) );
		const edgeMap = buildEdgeMap( triangles );
		const array = new Float32Array( edgeMap.size * 13 );

		let ptr = 0;
		edgeMap.forEach( ( adjacentTris, key ) =>
		{
			const [ aStr, bStr ] = key.split( '_' );
			const aPos = aStr.split( ',' ).map( Number );
			const bPos = bStr.split( ',' ).map( Number );
			const normalA = triNormals[ adjacentTris[ 0 ] ];
			const normalB = triNormals[ adjacentTris[ 1 ] ?? adjacentTris[ 0 ] ];

			const isCrease = adjacentTris.length === 1
				|| normalA.dot( normalB ) < Math.cos( THREE.MathUtils.degToRad( creaseAngle ) )
				? 1.0 : 0.0;

			array[ ptr++ ] = aPos[ 0 ];
			array[ ptr++ ] = aPos[ 1 ];
			array[ ptr++ ] = aPos[ 2 ];
			array[ ptr++ ] = bPos[ 0 ];
			array[ ptr++ ] = bPos[ 1 ];
			array[ ptr++ ] = bPos[ 2 ];
			array[ ptr++ ] = isCrease;
			array[ ptr++ ] = normalA.x;
			array[ ptr++ ] = normalA.y;
			array[ ptr++ ] = normalA.z;
			array[ ptr++ ] = normalB.x;
			array[ ptr++ ] = normalB.y;
			array[ ptr++ ] = normalB.z;
		} );

		const buffer = new THREE.InstancedInterleavedBuffer( array, 13, 1 );
		this.setAttribute( 'instanceStart', new THREE.InterleavedBufferAttribute( buffer, 3, 0 ) );
		this.setAttribute( 'instanceEnd', new THREE.InterleavedBufferAttribute( buffer, 3, 3 ) );
		this.setAttribute( 'isCrease', new THREE.InterleavedBufferAttribute( buffer, 1, 6 ) );
		this.setAttribute( 'normalA', new THREE.InterleavedBufferAttribute( buffer, 3, 7 ) );
		this.setAttribute( 'normalB', new THREE.InterleavedBufferAttribute( buffer, 3, 10 ) );
	}
}

function createCreaseSilhouetteMaterial( {
	color,
	linewidth,
	polygonOffsetFactor,
	polygonOffsetUnits,
} )
{
	return new LineMaterial( {
		vertexShader: vertexShaderSource,
		fragmentShader: fragmentShaderSource,
		color,
		linewidth,
		resolution: lineResolution,
		polygonOffset: true,
		polygonOffsetFactor,
		polygonOffsetUnits,
	} );
}

export class CreaseSilhouetteMesh extends Wireframe
{
	constructor( options = {} )
	{
		const settings = options?.isObject3D ? { geometry: options } : ( options ?? {} );
		const {
			geometry,
			creaseAngle = 45.0,
			color = 0x000000,
			linewidth = 0.5,
			polygonOffsetFactor = -2,
			polygonOffsetUnits = -1,
		} = settings;

		if ( !geometry?.isObject3D || !geometry.geometry?.isBufferGeometry )
			throw new TypeError( 'CreaseSilhouetteMesh requires a Mesh or an options object with a Mesh geometry.' );

		super(
			new CreaseSilhouetteGeometry( geometry, creaseAngle ),
			createCreaseSilhouetteMaterial( {
				color,
				linewidth,
				polygonOffsetFactor,
				polygonOffsetUnits,
			} ),
		);

		this.name = 'ThinEdgeLine';
	}
}
