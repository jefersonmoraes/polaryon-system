const style = { transform: 'translate(100px, -50.5px)' };
const uiZoom = 0.5;
let newStyle = { ...style };
const match = style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
if (match) {
    const x = parseFloat(match[1]) / uiZoom;
    const y = parseFloat(match[2]) / uiZoom;
    newStyle.transform = `translate(${x}px, ${y}px)`;
}
console.log(newStyle);
