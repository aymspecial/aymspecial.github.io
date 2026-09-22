#include <common>

uniform vec3 diffuse;
uniform float opacity;
uniform float linewidth;

in float isDraw;

void main()
{

	float alpha = opacity;
    vec4 diffuseColor;

    if( isDraw == 0.0 )
        discard;

	gl_FragColor = vec4( diffuseColor.rgb, alpha );
}
