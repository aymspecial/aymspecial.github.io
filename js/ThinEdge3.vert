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
    // 頂点からカメラ方向ベクトル（細線オフセットを加える）
    vec4 vp = modelViewMatrix * vec4( instanceStart, 1.0 );
    vec3 vViewDir = normalize( -vp.xyz );

    // isCrease ならばどうせ描画するから Silhouette 判定は要らない
    float isSilhouette = 0.0; // 仕様上はあっても無くても意味は無い
    if( isCrease == 0.0 ) // 計算結果じゃないのでこっちの方が分岐予測できる
    {
        // normalMatrix は modelViewMatrix 由来なので「ビュー空間法線」
        vec3 viewNormalA = normalize( normalMatrix * normalA );
        vec3 viewNormalB = normalize( normalMatrix * normalB );

        float d1 = dot( viewNormalA, vViewDir );
        float d2 = dot( viewNormalB, vViewDir );
        // 片方がプラス、片方がマイナスなら描画する
        isSilhouette = ( d1 * d2 < 0.0 ) ? 1.0 : 0.0;
    }

    // どちらでもなければ描画対象では無い
    if( isCrease == 0.0 && isSilhouette == 0.0 )
    {
        gl_Position = projectionMatrix * vp; // 適当に何か入れとく
        isDraw = 0.0;
        return;
    }

    isDraw = 1.0;   // ここからは「描画する」

	float aspect = resolution.x / resolution.y;

	// camera space
	vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
	vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

	// clip space
	vec4 clipStart = projectionMatrix * start;
	vec4 clipEnd = projectionMatrix * end;

	// ndc space
	vec3 ndcStart = clipStart.xyz / clipStart.w;
	vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

	// direction
	vec2 dir = ndcEnd.xy - ndcStart.xy;

	// account for clip-space aspect ratio
	dir.x *= aspect;
	dir = normalize( dir );

	vec2 offset = vec2( dir.y, - dir.x );
	// undo aspect ratio adjustment
	dir.x /= aspect;
	offset.x /= aspect;

	// sign flip
	if ( position.x < 0.0 )
        offset *= - 1.0;

	// endcaps
	if ( position.y < 0.0 )
		offset += - dir;
	else if ( position.y > 1.0 )
		offset += dir;

	// adjust for linewidth
	offset *= linewidth;

	// adjust for clip-space to screen-space conversion
    // maybe resolution hould be ased on viewport ...
	offset /= resolution.y;

	// select end
	vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

	// back to clip space
	offset *= clip.w;

	clip.xy += offset;

	gl_Position = clip;
}
