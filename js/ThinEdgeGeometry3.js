// ThinEdgeGeometry3.js
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

export class ThinEdgeGeometry3 extends LineSegmentsGeometry
{
    constructor( child, creaseAngle )
    {
        super();

        // child.geometry から edge を抽出する
        const geometry = BufferGeometryUtils.mergeVertices( child.geometry );
        geometry.computeVertexNormals(); // 念のため
        const index = geometry.index.array;
        const posarr = geometry.attributes.position.array;

        // 内部関数：三角形リスト
        function buildTriangles()
        {
            const triangles = [];

            // groups がある場合（複数マテリアル）
            if ( geometry.groups && geometry.groups.length > 0 )
            {
                geometry.groups.forEach( group =>
                {
                    const start = group.start;
                    const count = group.count;

                    for ( let i = start; i < start + count; i += 3 )
                    {
                        triangles.push( [
                            index[ i ],
                            index[ i + 1 ],
                            index[ i + 2 ]
                        ] );
                    }
                } );
            }
            else
            {
                // groups が無い場合（単一マテリアル）
                for ( let i = 0; i < index.length; i += 3 )
                {
                    triangles.push( [
                        index[ i ],
                        index[ i + 1 ],
                        index[ i + 2 ]
                    ] );
                }
            }

            return triangles;
        }

        // 内部関数：三角形法線
        function computeTriangleNormal( a, b, c )
        {
            const ax = posarr[ a * 3 ], ay = posarr[ a * 3 + 1 ], az = posarr[ a * 3 + 2 ];
            const bx = posarr[ b * 3 ], by = posarr[ b * 3 + 1 ], bz = posarr[ b * 3 + 2 ];
            const cx = posarr[ c * 3 ], cy = posarr[ c * 3 + 1 ], cz = posarr[ c * 3 + 2 ];

            const ab = new THREE.Vector3( bx - ax, by - ay, bz - az );
            const ac = new THREE.Vector3( cx - ax, cy - ay, cz - az );

            const normal = new THREE.Vector3().crossVectors( ab, ac ).normalize();
            return normal;
        }

        // 内部関数：edge → 隣接三角形
        function buildEdgeMap( triangles )
        {
            const map = new Map();

            const addEdge = ( a, b, triIndex ) =>
            {
                const ax = posarr[ a * 3 ], ay = posarr[ a * 3 + 1 ], az = posarr[ a * 3 + 2 ];
                const bx = posarr[ b * 3 ], by = posarr[ b * 3 + 1 ], bz = posarr[ b * 3 + 2 ];

                const A = `${ ax.toFixed( 6 ) },${ ay.toFixed( 6 ) },${ az.toFixed( 6 ) }`;
                const B = `${ bx.toFixed( 6 ) },${ by.toFixed( 6 ) },${ bz.toFixed( 6 ) }`;

                // 順序正規化
                const key = A < B ? `${ A }_${ B }` : `${ B }_${ A }`;

                if ( !map.has( key ) )
                    map.set( key, [] );
                map.get( key ).push( triIndex );
            }

            triangles.forEach( ( [ a, b, c ], i ) =>
            {
                addEdge( a, b, i );
                addEdge( b, c, i );
                addEdge( c, a, i );
            } );

            return map;
        }

        // -------------------------
        // 実処理
        // -------------------------
        const triangles = buildTriangles();
        const triNormals = triangles.map( ( [ a, b, c ] ) => computeTriangleNormal( a, b, c ) );
        const edgeMap = buildEdgeMap( triangles );

        // instanceStart / instanceEnd 用の配列を作る
        // 13 -> aPos(3), bPos(3), isCrease(1), normalA(3), normalB(3)
        const array = new Float32Array( edgeMap.size * 13 );

        let ptr = 0;
        edgeMap.forEach( ( adjacentTris, key ) =>
        {
            // 座標文字列を分解
            const [ aStr, bStr ] = key.split( "_" );

            // "x,y,z" → [x, y, z]
            const aPos = aStr.split( "," ).map( Number );
            const bPos = bStr.split( "," ).map( Number );

            // world space での法線を計算するために、隣接三角形の法線を取得
            const triA = adjacentTris[ 0 ];
            const triB = adjacentTris[ 1 ] ?? adjacentTris[ 0 ];

            const normalA = triNormals[ triA ];
            const normalB = triNormals[ triB ];

            // crease 判定
            let isCrease = 0.0;
            if ( adjacentTris.length === 1 )
            {
                // 境界 edge → 無条件で crease
                isCrease = 1.0;
            }
            else
            {
                // 通常の crease 判定
                const angle = normalA.dot( normalB );
                isCrease = angle < Math.cos( THREE.MathUtils.degToRad( creaseAngle ) ) ? 1.0 : 0.0;
            }

            // Apos
            array[ ptr++ ] = aPos[ 0 ];
            array[ ptr++ ] = aPos[ 1 ];
            array[ ptr++ ] = aPos[ 2 ];

            // Bpos
            array[ ptr++ ] = bPos[ 0 ];
            array[ ptr++ ] = bPos[ 1 ];
            array[ ptr++ ] = bPos[ 2 ];

            // isCrease
            array[ ptr++ ] = isCrease;

            // normalA
            array[ ptr++ ] = normalA.x;
            array[ ptr++ ] = normalA.y;
            array[ ptr++ ] = normalA.z;

            // normalB
            array[ ptr++ ] = normalB.x;
            array[ ptr++ ] = normalB.y;
            array[ ptr++ ] = normalB.z;
        } );

        // LineSegmentsGeometry に登録
        const buf = new THREE.InstancedInterleavedBuffer( array, 13, 1 );

        super.setAttribute( "instanceStart", new THREE.InterleavedBufferAttribute( buf, 3, 0 ) );
        super.setAttribute( "instanceEnd", new THREE.InterleavedBufferAttribute( buf, 3, 3 ) );
        super.setAttribute( "isCrease", new THREE.InterleavedBufferAttribute( buf, 1, 6 ) );
        super.setAttribute( "normalA", new THREE.InterleavedBufferAttribute( buf, 3, 7 ) );
        super.setAttribute( "normalB", new THREE.InterleavedBufferAttribute( buf, 3, 10 ) );
    }
}
