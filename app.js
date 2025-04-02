"use strict";
var createCanvas = function (width, height) {
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var context = canvas.getContext('2d');
    return [canvas, context];
};
var createGame = function () {
    var background = createGameBackground();
    var createLevel = function (levelData, resources, onLevelFinish) {
        var _a = createCanvas(1280, 720), canvas = _a[0], context = _a[1];
        var space = createSpace();
        var cancelFrameLoop;
        var inputControl = createInputControl(canvas);
        var spoolRenderSystem = createSpoolRenderSystem(resources);
        var cableRenderSystem = createCableRenderSystem();
        var shutdown = function () {
            cancelFrameLoop();
            inputControl.shutdown();
            space.shutdown();
            document.body.style.cursor = 'default';
        };
        var spoolSystem = createSpoolSystem(function () {
            shutdown();
            onLevelFinish();
        });
        var mouseDragSystem = createMouseDragSystem(inputControl);
        // uncomment this lines and the line at the bottom to enable editor mode
        // const levelEditorSystem = createLevelEditorSystem(space, inputControl);
        // space.registerSystem(levelEditorSystem);
        space.registerSystem(spoolRenderSystem);
        space.registerSystem(spoolSystem);
        space.registerSystem(cableRenderSystem);
        space.registerSystem(mouseDragSystem);
        levelData.spools.forEach(function (spoolData) {
            var spoolEntity = {
                pos: { x: spoolData[0], y: spoolData[1] },
                spool: { size: spoolData[2], type: NodeType.spool },
                render: { type: NodeType.spool },
            };
            space.addEntity(spoolEntity);
        });
        levelData.blocks.forEach(function (block) {
            var blockEntity = {
                pos: { x: block[0], y: block[1] },
                block: { size: block[2] },
                render: { type: NodeType.block }
            };
            space.addEntity(blockEntity);
        });
        levelData.isolators.forEach(function (isolator) {
            var blockEntity = {
                pos: { x: isolator[0], y: isolator[1] },
                spool: { size: isolator[2], type: NodeType.isolator },
                render: { type: NodeType.isolator }
            };
            space.addEntity(blockEntity);
        });
        var start = {
            pos: { x: levelData.start[0], y: levelData.start[1] },
            spool: { size: 0, type: NodeType.start },
            render: { type: NodeType.start }
        };
        var end = {
            pos: { x: levelData.end[0], y: levelData.end[1] },
            spool: { size: 0, type: NodeType.end },
            render: { type: NodeType.end },
            mouseDrag: { size: 30 }
        };
        var cable = {
            cable: { attachments: [{ entity: start, side: Side.left }, { entity: end, side: Side.left }] }
        };
        var finish = {
            finish: {},
            render: { type: NodeType.finish },
            pos: { x: levelData.finish[0], y: levelData.finish[1] }
        };
        //TODO: render layers
        space.addEntity(start);
        space.addEntity(finish);
        space.addEntity(end);
        space.addEntity(cable);
        var update = function (time) {
            mouseDragSystem.update(time);
            spoolSystem.update(time);
            // levelEditorSystem.update(time);
        };
        var render = function (time) {
            context.drawImage(background, 0, 0);
            cableRenderSystem.render(context, time);
            spoolRenderSystem.render(context, time);
        };
        cancelFrameLoop = startFrameLoop(function (time) {
            update(time);
            render(time);
        });
        return {
            canvas: canvas,
            shutdown: shutdown
        };
    };
    return {
        createLevel: createLevel
    };
};
// https://gist.github.com/blixt/f17b47c62508be59987b
var clamp = function (num, min, max) { return num < min ? min : num > max ? max : num; };
// https://gist.github.com/Joncom/e8e8d18ebe7fe55c3894
var lineLineIntersect = function (line1a, line1b, line2a, line2b) {
    // var s1_x, s1_y, s2_x, s2_y;
    var s1_x = line1b.x - line1a.x;
    var s1_y = line1b.y - line1a.y;
    var s2_x = line2b.x - line2a.x;
    var s2_y = line2b.y - line2a.y;
    // var s, t;
    var s = (-s1_y * (line1a.x - line2a.x) + s1_x * (line1a.y - line2a.y)) / (-s2_x * s1_y + s1_x * s2_y);
    var t = (s2_x * (line1a.y - line2a.y) - s2_y * (line1a.x - line2a.x)) / (-s2_x * s1_y + s1_x * s2_y);
    return s >= 0 && s <= 1 && t >= 0 && t <= 1;
};
// borrowed from https://codereview.stackexchange.com/questions/192477/circle-line-segment-collision
var lineCircleIntersect = function (lineA, lineB, circle, radius) {
    var dist;
    var v1x = lineB.x - lineA.x;
    var v1y = lineB.y - lineA.y;
    var v2x = circle.x - lineA.x;
    var v2y = circle.y - lineA.y;
    // get the unit distance along the line of the closest point to
    // circle center
    var u = (v2x * v1x + v2y * v1y) / (v1y * v1y + v1x * v1x);
    // if the point is on the line segment get the distance squared
    // from that point to the circle center
    if (u >= 0 && u <= 1) {
        dist = Math.pow((lineA.x + v1x * u - circle.x), 2) + Math.pow((lineA.y + v1y * u - circle.y), 2);
    }
    else {
        // if closest point not on the line segment
        // use the unit distance to determine which end is closest
        // and get dist square to circle
        dist = u < 0 ?
            Math.pow((lineA.x - circle.x), 2) + Math.pow((lineA.y - circle.y), 2) :
            Math.pow((lineB.x - circle.x), 2) + Math.pow((lineB.y - circle.y), 2);
    }
    return dist < radius * radius;
};
// https://jsfiddle.net/MadLittleMods/0eh0zeyu/
var dist2 = function (pt1, pt2) { return Math.pow(pt1.x - pt2.x, 2) + Math.pow(pt1.y - pt2.y, 2); };
// https://en.wikibooks.org/wiki/Algorithm_Implementation/Geometry/Tangents_between_two_circles
var getTangents = function (p1, r1, p2, r2) {
    var d_sq = (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
    if (d_sq <= (r1 - r2) * (r1 - r2))
        return [];
    var d = Math.sqrt(d_sq);
    var vx = (p2.x - p1.x) / d;
    var vy = (p2.y - p1.y) / d;
    // double[][] res = new double[4][4];
    var result = [];
    var i = 0;
    // Let A, B be the centers, and C, D be points at which the tangent
    // touches first and second circle, and n be the normal vector to it.
    //
    // We have the system:
    //   n * n = 1          (n is a unit vector)
    //   C = A + r1 * n
    //   D = B +/- r2 * n
    //   n * CD = 0         (common orthogonality)
    //
    // n * CD = n * (AB +/- r2*n - r1*n) = AB*n - (r1 -/+ r2) = 0,  <=>
    // AB * n = (r1 -/+ r2), <=>
    // v * n = (r1 -/+ r2) / d,  where v = AB/|AB| = AB/d
    // This is a linear equation in unknown vector n.
    for (var sign1 = +1; sign1 >= -1; sign1 -= 2) {
        var c = (r1 - sign1 * r2) / d;
        // Now we're just intersecting a line with a circle: v*n=c, n*n=1
        if (c * c > 1.0)
            continue;
        var h = Math.sqrt(Math.max(0.0, 1.0 - c * c));
        for (var sign2 = +1; sign2 >= -1; sign2 -= 2) {
            var nx = vx * c - sign2 * h * vy;
            var ny = vy * c + sign2 * h * vx;
            result[i] = [];
            var a = result[i] = new Array(2);
            a[0] = { x: p1.x + r1 * nx, y: p1.y + r1 * ny };
            a[1] = { x: p2.x + sign1 * r2 * nx, y: p2.y + sign1 * r2 * ny };
            i++;
        }
    }
    return result;
};
var sideOfLine = function (p1, p2, p) { return ((p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x)) > 0 ? Side.left : Side.right; };
/// <reference path="math-util.ts" />
var fract = function (n) { return ((n % 1) + 1) % 1; };
var subV = function (v1, v2) { return ({ x: v1.x - v2.x, y: v1.y - v2.y }); };
var addV = function (v1, v2) { return ({ x: v1.x + v2.x, y: v1.y + v2.y }); };
var mulVS = function (v, s) { return ({ x: v.x * s, y: v.y * s }); };
var divVS = function (v, s) { return mulVS(v, 1 / s); };
var lenV = function (v) { return Math.sqrt(v.x * v.x + v.y * v.y); };
var distV = function (v1, v2) { return lenV(subV(v1, v2)); };
var normalizeV = function (v) { return divVS(v, lenV(v) || 1); };
var perpLeftV = function (v) { return ({ x: -v.y, y: v.x }); };
var perpRightV = function (v) { return ({ x: v.y, y: -v.x }); };
var angleV = function (v) {
    var angle = Math.atan2(v.y, v.x);
    if (angle < 0)
        angle += 2 * Math.PI;
    return angle;
};
var copyIntoV = function (target, source) {
    target.x = source.x;
    target.y = source.y;
};
var copyV = function (source) { return ({ x: source.x, y: source.y }); };
var fractV = function (v) { return ({ x: fract(v.x), y: fract(v.y) }); };
var floorV = function (v) { return ({ x: ~~v.x, y: ~~v.y }); };
/// <reference path="canvas.ts" />
/// <reference path="vector.ts" />
var mix = function (a, b, m) { return (1 - m) * a + m * b; };
var mixCol = function (a, b, m) { return ({
    r: mix(a.r, b.r, m),
    g: mix(a.g, b.g, m),
    b: mix(a.b, b.b, m),
    a: mix(a.a, b.a, m),
}); };
var halfV = { x: 0.5, y: 0.5 };
var v10 = { x: 1, y: 0 };
var v01 = { x: 0, y: 1 };
var v11 = { x: 1, y: 1 };
var n21 = function (v) { return ((Math.sin(v.x * 100 + v.y * 6574) + 1) * 564) % 1; };
var noise = function (v) {
    var lv = fractV(v);
    var id = floorV(v);
    var bl = n21(id);
    var br = n21(addV(id, v10));
    var b = mix(bl, br, lv.x);
    var tl = n21(addV(id, v01));
    var tr = n21(addV(id, v11));
    var t = mix(tl, tr, lv.x);
    return mix(b, t, lv.y);
};
var smoothstep = function (min, max, value) {
    var x = clamp((value - min) / (max - min), 0, 1);
    return x * x * (3 - 2 * x);
};
var newCol = function (r, g, b, a) {
    if (r === void 0) { r = 1; }
    if (g === void 0) { g = 1; }
    if (b === void 0) { b = 1; }
    if (a === void 0) { a = 1; }
    return ({ r: r, g: g, b: b, a: a });
};
var mulCol = function (color, v) { return ({
    r: color.r * v,
    g: color.g * v,
    b: color.b * v,
    a: color.a
}); };
var addCol = function (a, b) {
    return {
        r: a.r + b.r * b.a,
        g: a.g + b.g * b.a,
        b: a.b + b.b * b.a,
        a: a.a + b.a
    };
};
var generateImage = function (width, height, cb) {
    var _a = createCanvas(width, height), canvas = _a[0], context = _a[1];
    var imageData = context.getImageData(0, 0, width, height);
    var buf = new ArrayBuffer(imageData.data.length);
    var buf8 = new Uint8ClampedArray(buf);
    var data32 = new Uint32Array(buf);
    var v = {};
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            v.x = x / (width - 1);
            v.y = y / (height - 1);
            var c = cb(v);
            data32[y * width + x] =
                (clamp(c.a * 255, 0, 255) << 24) | // alpha
                    (clamp(c.b * 255, 0, 255) << 16) | // blue
                    (clamp(c.g * 255, 0, 255) << 8) | // green
                    clamp(c.r * 255, 0, 255);
        }
    }
    imageData.data.set(buf8);
    context.putImageData(imageData, 0, 0);
    return canvas;
};
// https://gist.github.com/sakrist/8706749
var createHexField = function (v, scale) {
    var _a = mulVS(v, scale), x = _a.x, y = _a.y;
    x *= 0.57735 * 2.0;
    y += (Math.floor(x) % 2) * 0.5;
    x = Math.abs(x % 1 - 0.5);
    y = Math.abs(y % 1 - 0.5);
    return Math.abs(Math.max(x * 1.5 + y, y * 2.0) - 1.0);
};
var createMetalPlate = function (a, d) {
    var shading = smoothstep(0.91, 0.94, d) - smoothstep(0.41, 0.42, d);
    a += shading;
    return 0.9 + 0.1 * Math.sin(a * 6) * 0.9 + 0.1 * Math.sin(a * 4)
        - (noise({ x: (a + 4 + d * 5) * 2, y: d * 80 }) * 0.1) + shading * 0.2;
};
var createCoilSprite = function (size) {
    var sw = 4 / size;
    var hexFieldScale = size / 4;
    var hexFieldBrightness = 0.7;
    var ringBrightness = 0.4;
    var gridShadowBlur = 0.1;
    var gridShadowStrength = 1;
    var ringWidth = 0.2;
    var buttonSize = 0.5;
    var gridColor = newCol(0.615, 0.705, 1, 1);
    var metalColor = newCol(1, 1, 1, 1);
    var shadowBlur = 0.2;
    var shadowDistance = 0.04;
    var shadowScale = 1.1;
    var shadowStrength = 0.5;
    var image = generateImage(Math.round(size * 1.1), Math.round(size * 1.1), function (v) {
        v = mulVS(v, 1.1); // scale to make room for shadow
        var centerV = subV(v, halfV);
        var a = Math.atan2(centerV.y, centerV.x);
        var d = lenV(centerV) * 2;
        var grid = hexFieldBrightness * smoothstep(0.3, 1, 1 - createHexField(v, hexFieldScale)); // TODO: FOR SPOOL
        var gridShadow = 1 - (smoothstep(1 - ringWidth * 0.65, 1 - ringWidth - gridShadowBlur, d) -
            smoothstep(buttonSize + gridShadowBlur, buttonSize * 0.85, d));
        grid -= (gridShadow * gridShadowStrength);
        var metalPlate = createMetalPlate(a, d) * ringBrightness;
        var ringMask = smoothstep(1 - ringWidth, 1 - ringWidth + sw, d) + smoothstep(buttonSize, buttonSize - sw, d);
        var spriteCol = mixCol(mulCol(gridColor, grid), mulCol(metalColor, metalPlate), ringMask);
        var shadow = smoothstep(1, 1 - shadowBlur, lenV(subV(centerV, {
            x: shadowDistance,
            y: shadowDistance
        })) * 2 / shadowScale) * shadowStrength;
        var shadowCol = newCol(0, 0, 0, shadow);
        return mixCol(spriteCol, shadowCol, smoothstep(1 - sw, 1, d));
    });
    return image;
};
var createIsolatorSprite = function (size) {
    var sw = 4 / size;
    var hexFieldScale = size / 8;
    var hexFieldBrightness = 0.7;
    var ringBrightness = 0.4;
    var gridShadowBlur = 0.2;
    var gridShadowStrength = 0.6;
    var ringWidth = 0.15;
    var buttonSize = 0.3;
    var gridColor = newCol(0.815, 0.2705, .2, 1); // isolate red
    var metalColor = newCol(1, 1, 1, 1);
    var shadowBlur = 0.2;
    var shadowDistance = 0.04;
    var shadowScale = 1.1;
    var shadowStrength = 0.5;
    var image = generateImage(Math.round(size * 1.1), Math.round(size * 1.1), function (v) {
        v = mulVS(v, 1.1); // scale to make room for shadow
        var centerV = subV(v, halfV);
        var a = Math.atan2(centerV.y, centerV.x); // polar x
        var d = lenV(centerV) * 2; // polar y
        var grid = hexFieldBrightness * smoothstep(0.02, 0.41, 1 - createHexField(v, hexFieldScale)); // TODO FOR ISOLATOR
        var gridShadow = 1 - (smoothstep(1 - ringWidth * 0.65, 1 - ringWidth - gridShadowBlur, d) -
            smoothstep(buttonSize + gridShadowBlur, buttonSize * 0.85, d));
        grid -= (gridShadow * gridShadowStrength);
        var metalPlate = createMetalPlate(a, d) * ringBrightness;
        var ringMask = smoothstep(1 - ringWidth, 1 - ringWidth + sw, d) + smoothstep(buttonSize, buttonSize - sw, d);
        var spriteCol = mixCol(mulCol(gridColor, grid), mulCol(metalColor, metalPlate), ringMask);
        var shadow = smoothstep(1, 1 - shadowBlur, lenV(subV(centerV, {
            x: shadowDistance,
            y: shadowDistance
        })) * 2 / shadowScale) * shadowStrength;
        var shadowCol = newCol(0, 0, 0, shadow);
        return mixCol(spriteCol, shadowCol, smoothstep(1 - sw, 1, d));
    });
    return image;
};
var createGear = function (px, py, outerSize, innerSize, step) {
    var s = Math.min(fract(px), fract(1 - px)) * 2;
    var spikes = smoothstep(0, step * 8, s - py);
    var center = smoothstep(innerSize, innerSize + step, 1 - py);
    var cut = smoothstep(outerSize + step, outerSize, 1 - py);
    return clamp(spikes + center - cut, 0, 1);
};
var createBlockSprite = function (size) {
    var image = generateImage(size, size, function (v) {
        var cv = subV(v, halfV);
        var d = lenV(cv) * 2;
        var atan = Math.atan2(cv.y, cv.x);
        var px = atan / (Math.PI * 2) + 0.5; // polar twistedMx
        var twistedPx = atan / (Math.PI * 2) + 0.5 + d * 0.3; // polar twistedMx
        var twistedMx = twistedPx * Math.round(8 + size / 50);
        var mx = px * Math.round(5 + size / 200);
        var m = Math.min(fract(twistedMx), fract(1 - twistedMx));
        var bladeAlpha = smoothstep(0.0, 0.08, m * 0.5 - d + 0.7);
        var shadow = 1 - smoothstep(0.9, 0.2, d);
        var blade = 1.4 * d - bladeAlpha * 0.5;
        var gear = createGear(mx, d, 0.45, 0.52, 0.02);
        var gearCol = 0.5 + 0.5 * createMetalPlate(atan * 1, d);
        blade = mix(mix(shadow, blade, bladeAlpha), gear * 0.3 * gearCol, gear);
        return newCol(blade, blade, blade, bladeAlpha + (1 - shadow));
    });
    return image;
};
var createInnerShadow = function (v) {
    var d = lenV(v) * 2;
    var dm = lenV(subV(v, mulVS(v11, 0.05))) * 2;
    var val = smoothstep(1, 0.5, dm * 0.8) * 0.2;
    var a = smoothstep(1, 0.85, d);
    return newCol(val, val, val, a);
};
var createLedGlass = function (v) {
    var d = (lenV(v) * 2) * 1.2;
    var val = smoothstep(1, 0.0, d) * 0.25;
    var a = smoothstep(0.99, 0.9, d);
    return newCol(val, val, val, a);
};
var createLedGlassReflection = function (v) {
    var d = (lenV(v) * 2) * 1.5;
    var dm = lenV(subV(v, mulVS(v11, 0.14))) * 1.01;
    var val = smoothstep(1, 0.6, d) *
        smoothstep(0.2, 0.5, dm);
    return newCol(val, val, val, val);
};
var createLedSprite = function () { return generateImage(21, 21, function (v) {
    var cv = subV(v, halfV);
    var innerShadow = createInnerShadow(cv);
    var ledGlass = createLedGlass(cv);
    var ledGlassReflection = createLedGlassReflection(cv);
    return addCol(addCol(innerShadow, ledGlass), ledGlassReflection);
}); };
var white = newCol(1, 1, 1, 1);
var createGlow = function (color) { return generateImage(80, 80, function (v) {
    var cv = subV(v, halfV);
    var d = 1 - lenV(cv) * 2;
    var result = mixCol(color, white, smoothstep(0.6, 0.89, d));
    var a = smoothstep(0.0, 1, d);
    return newCol(result.r, result.g, result.b, a * a * a);
}); };
var createMetal = function (a, d) {
    return 0.9 + 0.1 * Math.sin(a * 6) * 0.9 + 0.1 * Math.sin(a * 4)
        - (noise({ x: (a + 4 + d * 5) * 2, y: d * 80 }) * 0.1);
};
var createRingGlow = function (color) { return generateImage(62, 62, function (v) {
    var cv = subV(v, halfV);
    var d = 1 - lenV(cv) * 2;
    var result = mixCol(color, white, smoothstep(0.45, 0.5, d) * smoothstep(0.55, 0.5, d));
    var a = smoothstep(0.0, 0.5, d) * smoothstep(1, 0.5, d);
    return newCol(result.r, result.g, result.b, a * a * a);
}); };
var createConnectorButtons = function (lightColor, size) {
    var shadowBlur = 0.2;
    var shadowDistance = 0.04;
    var shadowScale = 1.1;
    var shadowStrength = 0.2;
    var image = generateImage(size, size, function (v) {
        v = mulVS(v, 1.1); // scale to make room for shadow
        var cv = subV(v, halfV);
        var atan = Math.atan2(cv.y, cv.x);
        var py = lenV(cv) * 2;
        // back
        var backAlpha = smoothstep(1, .96, py);
        var shading = smoothstep(0.9, 0.80, py) * 0.3 + 0.3;
        shading -= smoothstep(0.7, 0.60, py) * smoothstep(0.2, 0.30, py) * 0.4;
        var backVal = createMetal(atan + (shading * 3), py) * shading;
        var backCol = newCol(backVal, backVal, backVal, backAlpha);
        // light
        var lightAlpha = smoothstep(0.35, 0.45, py) * smoothstep(0.55, 0.45, py);
        var col = mixCol(backCol, lightColor, lightAlpha);
        var shadow = smoothstep(1, 1 - shadowBlur, lenV(subV(cv, {
            x: shadowDistance,
            y: shadowDistance
        })) * 2 / shadowScale) * shadowStrength;
        var shadowCol = newCol(0, 0, 0, shadow);
        return mixCol(col, shadowCol, smoothstep(0.8, 1, py));
    });
    return image;
};
var createGameBackground = function () {
    var _a = createCanvas(1920, 1280), canvas = _a[0], context = _a[1];
    var image = generateImage(64, 64, function (v) {
        var m = mulVS(v, 4);
        var col = 1 - smoothstep(0.7, 1, createHexField(m, 1)) * 0.7;
        return newCol(col * 0.117, col * 0.149, col * 0.188, 1);
    });
    var highlight = generateImage(128 * 2, 72 * 2, function (v) {
        var w = 0.01;
        var c = smoothstep(0, w * 0.6, v.x) * smoothstep(1, 1 - w * 0.6, v.x) *
            smoothstep(0, w, v.y) * smoothstep(1, 1 - w, v.y);
        return newCol(1, 1, 1, (1 - c) * 0.04);
    });
    for (var y = 0; y < 12; y++) {
        for (var x = 0; x < 24; x++) {
            context.drawImage(image, x * 54, y * 63);
        }
    }
    context.drawImage(highlight, 0, 0, 1280, 720);
    return canvas;
};
var elementById = function (id) { return document.getElementById(id); };
var titleElement = elementById('title');
var gameElement = elementById('game');
var loadingElement = elementById('loading');
var menuElement = elementById('menu');
var levelDoneElement = elementById('levelDone');
var nextMsg = elementById('nextMsg');
var nextBtn = elementById('nextBtn');
var startBtn = elementById('startBtn');
var continueBtn = elementById('continueBtn');
var contentElement = elementById('content');
var resetElement = elementById('reset');
var resetBtn = elementById('resetBtn');
var levelInfo = elementById('levelInfo');
var nodeInfo = elementById('nodeInfo');
var descriptionElement = elementById('description');
var skipBtn = elementById('skipBtn');
var backBtn = elementById('backBtn');
var saveLevel = function (level) {
    try {
        localStorage.setItem('level', '' + level);
    }
    catch (e) {
        // IE and edge don't support localstorage when opening the file from disk
    }
};
var loadLevel = function () {
    try {
        return parseInt(localStorage.getItem('level')) || 0;
    }
    catch (e) {
        return 0;
    }
};
var removeElement = function (element) {
    element.parentNode.removeChild(element);
};
var fadeTime = 0.4;
var showElement = function (element, onComplete) {
    var elements = Array.isArray(element) ? element : [element];
    elements.forEach(function (e) {
        e.style.visibility = 'visible';
        e.style.opacity = '0';
    });
    tween(0, 1, fadeTime, function (t) {
        elements.forEach(function (e) {
            e.style.opacity = t.toString();
        });
    }, function () {
        onComplete && onComplete();
    });
};
var hideElement = function (element, onComplete) {
    var elements = Array.isArray(element) ? element : [element];
    tween(1, 0, fadeTime, function (t) {
        elements.forEach(function (e) {
            e.style.opacity = t.toString();
        });
    }, function () {
        elements.forEach(function (e) {
            e.style.visibility = 'hidden';
        });
        onComplete && onComplete();
    });
};
var createInputControl = function (canvas) {
    var mouseDown = false;
    var mousePos = { x: 0, y: 0 };
    var mouseOverTargets = [];
    var mouseOutTargets = [];
    var mouseDownTargets = [];
    var mouseMoveListener = function (e) {
        var rect = canvas.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;
        e.preventDefault();
    };
    var mouseDownListener = function (e) {
        mouseDown = true;
        mouseOverTargets.forEach(function (watch) {
            var mouseDownCallback = watch[1].mouseDown;
            mouseDownCallback && mouseDownCallback();
            mouseDownTargets.push(watch);
        });
        e.preventDefault();
    };
    var mouseUpListener = function (e) {
        mouseDown = false;
        mouseDownTargets.forEach(function (watch) {
            var mouseUpCallback = watch[1].mouseUp;
            mouseUpCallback && mouseUpCallback();
        });
        mouseDownTargets.length = 0;
    };
    document.addEventListener('mousemove', mouseMoveListener);
    document.addEventListener('mousedown', mouseDownListener);
    document.addEventListener('mouseup', mouseUpListener);
    var dragControl = function (target, callbacks) {
        mouseOutTargets.push([target, callbacks]);
    };
    var update = function () {
        for (var i = mouseOutTargets.length - 1; i >= 0; --i) {
            var watch = mouseOutTargets[i];
            var callbacks = watch[1];
            if (distV(mousePos, watch[0].pos) <= watch[0].mouseDrag.size) {
                callbacks.mouseOver && callbacks.mouseOver();
                mouseOutTargets.splice(i, 1);
                mouseOverTargets.push(watch);
            }
        }
        for (var i = mouseOverTargets.length - 1; i >= 0; --i) {
            var watch = mouseOverTargets[i];
            var callbacks = watch[1];
            mouseDown && callbacks.mouseDownUpdate && callbacks.mouseDownUpdate();
            if (distV(mousePos, watch[0].pos) > watch[0].mouseDrag.size) {
                callbacks.mouseOut && callbacks.mouseOut();
                mouseOverTargets.splice(i, 1);
                mouseOutTargets.push(watch);
            }
        }
    };
    var shutdown = function () {
        document.removeEventListener('mousemove', mouseMoveListener);
        document.removeEventListener('mousedown', mouseDownListener);
        document.removeEventListener('mouseup', mouseUpListener);
    };
    return {
        update: update,
        dragControl: dragControl,
        mousePos: mousePos,
        isMouseDown: function () { return (mouseDown); },
        shutdown: shutdown,
        targets: mouseOverTargets
    };
};
var createLevelEditorSystem = function (space, inputControl) {
    var mouseWheelListener = function (e) {
        e.preventDefault();
        var spool = inputControl.targets[0][0].spool || inputControl.targets[0][0].block;
        if (!spool) {
            return;
        }
        var min = 30;
        var max = 160;
        if (spool.type == NodeType.isolator) {
            max = 80;
        }
        if (e.deltaY < 0) {
            spool.size !== max && (spool.size += 10);
        }
        else {
            spool.size !== min && (spool.size -= 10);
        }
    };
    var keydownListener = function (e) {
        if (e.key === '1') {
            var spoolEntity = {
                pos: { x: inputControl.mousePos.x - 1, y: inputControl.mousePos.y },
                spool: { size: 50, type: NodeType.spool },
                render: { type: NodeType.spool },
            };
            // (spoolEntity as any).mouseDrag = {size: 20};
            space.addEntity(spoolEntity);
        }
        if (e.key === '2') {
            var spoolEntity = {
                pos: { x: inputControl.mousePos.x, y: inputControl.mousePos.y },
                block: { size: 50 },
                render: { type: NodeType.block },
            };
            // (spoolEntity as any).mouseDrag = {size: 20};
            space.addEntity(spoolEntity);
        }
        if (e.key === '3') {
            var spoolEntity = {
                pos: { x: inputControl.mousePos.x, y: inputControl.mousePos.y },
                spool: { size: 40, type: NodeType.isolator },
                render: { type: NodeType.isolator },
            };
            // (spoolEntity as any).mouseDrag = {size: 20};
            space.addEntity(spoolEntity);
        }
        if (e.key === 'F2') {
            var level_1 = { spools: [], isolators: [], blocks: [] };
            space.entities.forEach(function (entity) {
                if (entity.spool) {
                    switch (entity.spool.type) {
                        case NodeType.spool:
                            level_1.spools.push([entity.pos.x, entity.pos.y, entity.spool.size]);
                            break;
                        case NodeType.start:
                            level_1.start = [entity.pos.x, entity.pos.y];
                            break;
                        case NodeType.end:
                            level_1.end = [110, 360];
                            break;
                        case NodeType.isolator:
                            level_1.isolators.push([entity.pos.x, entity.pos.y, entity.spool.size]);
                            break;
                    }
                }
                if (entity.finish) {
                    level_1.finish = [entity.pos.x, entity.pos.y];
                }
                if (entity.block) {
                    level_1.blocks.push([entity.pos.x, entity.pos.y, entity.block.size]);
                }
            });
            console.log(JSON.stringify(level_1));
        }
    };
    window.addEventListener('keydown', keydownListener);
    window.addEventListener('wheel', mouseWheelListener);
    return {
        addEntity: function (entity) {
            if (entity.spool) {
                if (entity.spool.type != NodeType.end) {
                    entity.mouseDrag = { size: entity.spool.size };
                }
            }
            if (entity.block) {
                entity.mouseDrag = { size: entity.block.size };
            }
        },
        update: function (time) {
        },
        shutdown: function () {
            window.removeEventListener('keydown', keydownListener);
        }
    };
};
var gameData = {
    levels: [
        // {  LEVEL TEMPLATE
        //     'spools': [[864, 336, 150], [560, 378, 50]],
        //     'isolators': [],
        //     'blocks': [],
        //     'start': [50, 360],
        //     'finish': [1230, 360],
        //     'end': [110, 360]
        // }
        // 1
        {
            'spools': [[460, 207, 70], [468, 516, 70]],
            'isolators': [],
            'blocks': [],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[440, 540, 60], [846, 556, 60], [645, 173, 90]],
            'isolators': [],
            'blocks': [[777, 369, 110], [249, 461, 70]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[871, 447, 50], [659, 590, 50], [629, 267, 40]],
            'isolators': [[438, 561, 40], [497, 148, 40]],
            'blocks': [[241, 435, 70], [675, 422, 90], [324, 215, 50]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[872, 496, 130], [508, 234, 60], [508, 486, 60], [871, 190, 130]],
            'isolators': [[234, 525, 40], [237, 182, 40]],
            'blocks': [[667, 288, 60], [669, 427, 60], [593, 132, 60], [597, 588, 60]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[845, 156, 70], [595, 443, 60], [668, 609, 60], [396, 416, 50]],
            'isolators': [[832, 396, 40], [556, 247, 40]],
            'blocks': [[696, 204, 60], [721, 392, 60], [498, 345, 50]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[664, 338, 70], [365, 171, 90], [929, 170, 90], [1011, 559, 80], [372, 558, 90]],
            'isolators': [[729, 561, 40], [1149, 266, 40]],
            'blocks': [[757, 203, 70], [846, 375, 70], [585, 549, 80], [1150, 429, 50]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[502, 259, 60], [508, 458, 60], [979, 356, 50], [346, 573, 60], [319, 141, 60]],
            'isolators': [[724, 361, 40], [720, 142, 40]],
            'blocks': [[609, 353, 60], [379, 451, 50], [848, 360, 70]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[957, 156, 70], [378, 570, 70], [507, 109, 60]],
            'isolators': [[568, 536, 40], [382, 198, 40], [659, 112, 40], [940, 348, 40]],
            'blocks': [[756, 445, 100], [1122, 234, 50]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[629, 130, 40], [811, 482, 50], [385, 491, 50], [386, 317, 50], [976, 569, 40], [844, 139, 60], [1161, 138, 50]],
            'isolators': [[222, 230, 40], [216, 587, 30]],
            'blocks': [[619, 367, 160], [1015, 255, 130]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[922, 509, 150], [257, 552, 60], [201, 200, 50], [509, 519, 50], [520, 134, 50], [937, 257, 50], [1111, 133, 50]],
            'isolators': [[678, 465, 40], [679, 291, 40]],
            'blocks': [[887, 113, 80], [392, 438, 70], [699, 573, 50], [1163, 468, 50]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[228, 193, 150], [326, 563, 80], [557, 209, 70], [785, 199, 50], [1043, 593, 80], [1015, 188, 130], [791, 548, 50], [543, 544, 50], [511, 373, 30], [685, 333, 30]],
            'isolators': [[687, 446, 30], [1205, 455, 30]],
            'blocks': [[442, 116, 50], [982, 400, 50], [1203, 265, 50], [1185, 563, 50], [776, 382, 60], [408, 428, 50]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[669, 355, 80], [668, 187, 50], [666, 70, 30], [668, 514, 50], [673, 653, 30], [473, 361, 50], [852, 353, 50], [986, 348, 30], [335, 361, 30]],
            'isolators': [],
            'blocks': [[804, 476, 50], [552, 244, 60], [857, 174, 90], [489, 541, 80]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[549, 114, 60], [213, 345, 30], [389, 186, 50], [834, 93, 70], [297, 272, 40], [389, 564, 50], [606, 542, 50], [815, 566, 50]],
            'isolators': [],
            'blocks': [[839, 300, 130], [1062, 343, 80], [483, 354, 50], [337, 419, 70], [485, 537, 30], [204, 507, 50]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[402, 380, 90], [758, 379, 90], [890, 195, 50], [324, 166, 50], [1036, 91, 40], [1038, 461, 50], [1055, 622, 40]],
            'isolators': [[600, 100, 40], [595, 617, 40]],
            'blocks': [[159, 251, 50], [733, 156, 70], [886, 553, 80], [988, 303, 80], [1167, 238, 50], [1082, 536, 30]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[647, 360, 160], [326, 233, 30], [462, 111, 30], [646, 71, 30], [819, 120, 30], [932, 277, 30], [930, 468, 30], [809, 602, 30], [626, 644, 30], [438, 579, 30], [334, 404, 30]],
            'isolators': [[188, 119, 30], [192, 568, 30]],
            'blocks': [[1069, 367, 90], [354, 134, 50], [561, 106, 40], [828, 232, 50], [855, 392, 50], [711, 577, 50], [447, 466, 50], [431, 258, 60]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
        {
            'spools': [[335, 304, 50], [655, 299, 60], [961, 191, 50], [318, 584, 50], [650, 580, 50], [1007, 591, 50], [346, 115, 40], [1139, 136, 50], [1198, 581, 30], [901, 497, 30]],
            'isolators': [],
            'blocks': [[1090, 294, 70], [985, 487, 40], [765, 482, 60], [846, 192, 50], [538, 149, 50], [1037, 134, 30], [1135, 530, 30]],
            'start': [50, 360],
            'finish': [1230, 360],
            'end': [110, 360]
        },
    ]
};
var createMouseDragSystem = function (inputControl) {
    var sp = { x: 0, y: 0 };
    var spools = [];
    var dragEntity;
    var finishEntity;
    var isDragging = false;
    var isOver = false;
    return {
        addEntity: function (entity) {
            // we need the spools to check if we collide
            if (entity.spool && (entity.spool.type === NodeType.spool || entity.spool.type === NodeType.isolator)) {
                spools.push(entity);
            }
            if (entity.finish) {
                finishEntity = entity;
            }
            if (entity.mouseDrag) {
                inputControl.dragControl(entity, {
                    mouseOver: function () {
                        isOver = true;
                        if (inputControl.isMouseDown()) {
                            return;
                        }
                        document.body.style.cursor = 'pointer';
                        dragEntity = entity;
                        entity.render.hover = true;
                    },
                    mouseOut: function () {
                        document.body.style.cursor = 'default';
                        isOver = false;
                        if (!isDragging) {
                            entity.render.hover = false;
                        }
                    },
                    mouseDown: function () {
                        isDragging = true;
                        copyIntoV(sp, subV(inputControl.mousePos, entity.pos));
                    },
                    mouseUp: function () {
                        isDragging = false;
                        if (!isOver) {
                            entity.render.hover = false;
                        }
                    },
                    mouseDownUpdate: function () {
                    }
                });
            }
        },
        update: function (time) {
            inputControl.update();
            if (!dragEntity) {
                return;
            }
            isDragging && copyIntoV(dragEntity.pos, subV(inputControl.mousePos, sp));
            var v1 = dragEntity.pos;
            // push away from border
            v1.x = clamp(v1.x, 0, 1280);
            v1.y = clamp(v1.y, 0, 720);
            // push end node away from spools
            spools.forEach(function (spool) {
                if (spool === dragEntity) {
                    return;
                }
                var v2 = spool.pos;
                var dist = 10 + spool.spool.size;
                if (distV(v1, v2) < dist) {
                    var dir = normalizeV(subV(v1, v2));
                    if (dir.x == 0 && dir.y == 0) {
                        dir.x = 1;
                    }
                    var v = mulVS(dir, dist);
                    dragEntity.pos = addV(v2, v);
                }
            });
            // snap to finish
            if (distV(v1, finishEntity.pos) < 30) {
                finishEntity.finish.connected = true;
                copyIntoV(dragEntity.pos, finishEntity.pos);
            }
            else {
                finishEntity.finish.connected = false;
            }
        }
    };
};
var createSpoolRenderSystem = function (resources) {
    var entities = [];
    var coils = resources.coils, blocks = resources.blocks, isolators = resources.isolators, drag = resources.drag, finish = resources.finish, start = resources.start;
    return {
        addEntity: function (entity) {
            if (entity.render) {
                entities.push(entity);
            }
        },
        render: function (context, time) {
            entities.forEach(function (entity) {
                switch (entity.render.type) {
                    case NodeType.spool:
                        context.drawImage(coils[entity.spool.size], entity.pos.x - entity.spool.size - 6, entity.pos.y - entity.spool.size - 6);
                        context.drawImage(resources.led, entity.pos.x - 11, entity.pos.y - 11);
                        if (entity.spool.overpowered) {
                            context.drawImage(resources.redGlow, entity.pos.x - 40, entity.pos.y - 40);
                        }
                        else if (entity.spool.powered) {
                            context.drawImage(resources.greenGlow, entity.pos.x - 40, entity.pos.y - 40);
                        }
                        break;
                    case NodeType.isolator:
                        context.drawImage(isolators[entity.spool.size], entity.pos.x - entity.spool.size - 6, entity.pos.y - entity.spool.size - 6);
                        break;
                    case NodeType.block:
                        context.save();
                        context.translate(entity.pos.x, entity.pos.y);
                        context.rotate(time);
                        var sprite = blocks[entity.block.size];
                        context.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
                        context.restore();
                        break;
                    case NodeType.finish:
                        context.drawImage(finish, entity.pos.x - 32, entity.pos.y - 32);
                        break;
                    case NodeType.start:
                        context.drawImage(start, entity.pos.x - 24, entity.pos.y - 24);
                        break;
                    case NodeType.end:
                        context.drawImage(drag, entity.pos.x - 32, entity.pos.y - 32);
                        if (entity.render.hover) {
                            context.globalAlpha = 0.8 + (0.2 * Math.sin(time * 6));
                            context.drawImage(resources.dragGlow, entity.pos.x - 31, entity.pos.y - 31);
                        }
                        else {
                            context.globalAlpha = 0.2 + (0.2 * Math.sin(time * 3));
                            context.drawImage(resources.dragGlow, entity.pos.x - 31, entity.pos.y - 31);
                        }
                        context.globalAlpha = 1;
                        break;
                }
            });
        }
    };
};
var createCableRenderSystem = function () {
    var entities = [];
    return {
        addEntity: function (entity) {
            if (entity.cable) {
                entities.push(entity);
            }
        },
        render: function (context) {
            entities.forEach(function (entity) {
                var attachments = entity.cable.attachments;
                for (var i = 0; i < attachments.length - 1; i++) {
                    var a = attachments[i];
                    var b = attachments[i + 1];
                    context.save();
                    if (a.overlap) {
                        context.setLineDash([5, 10]);
                    }
                    if (a.isolated) {
                        context.strokeStyle = '#d04533';
                        context.lineWidth = 5;
                    }
                    else {
                        context.strokeStyle = 'white';
                        context.lineWidth = 3;
                    }
                    context.lineCap = 'round';
                    context.beginPath();
                    context.moveTo(a.outPos.x, a.outPos.y);
                    context.lineTo(b.inPos.x, b.inPos.y);
                    context.stroke();
                    context.restore();
                }
            });
        }
    };
};
var generateResources = function (onProgress, onDone) {
    var resCalls = [];
    var coilSprites = {};
    var blockSprites = {};
    var isolatorSprites = {};
    [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160].forEach(function (size) {
        resCalls.push(function () {
            coilSprites[size] = createCoilSprite(size * 2 + 10);
        });
    });
    [30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160].forEach(function (size) {
        resCalls.push(function () {
            blockSprites[size] = createBlockSprite(size * 2 + 6);
        });
    });
    [30, 40, 50, 60, 70, 80].forEach(function (size) {
        resCalls.push(function () {
            isolatorSprites[size] = createIsolatorSprite(size * 2 + 10);
        });
    });
    var led = createLedSprite();
    var greenGlow = createGlow(newCol(0, 1, 0));
    var redGlow = createGlow(newCol(1, 0, 0));
    var dragPoint = createConnectorButtons(newCol(0.2, 0.6, 0.2), 70);
    var start = createConnectorButtons(newCol(0.2, 0.2, 0.2), 52);
    var dragGlow = createRingGlow(newCol(0, 1, 0));
    var finish = createConnectorButtons(newCol(1, 0.4, 0.4), 70);
    //Tutorial Screens
    var _a = createCanvas(450, 264), tutorial1 = _a[0], tutCtx1 = _a[1];
    tutorial1.className = 'tutorial';
    tutCtx1.font = '20px sans-serif';
    tutCtx1.fillStyle = '#ccc';
    tutCtx1.fillText('1. Drag the cable ...', 20, 50);
    tutCtx1.drawImage(dragPoint, 358, 10);
    tutCtx1.fillText('2. ...around the power nodes...', 20, 140);
    tutCtx1.drawImage(createCoilSprite(80), 350, 90);
    tutCtx1.fillText('3. ...and plug it into the socket!', 20, 230);
    tutCtx1.drawImage(finish, 358, 190);
    var _b = createCanvas(450, 100), tutorial2 = _b[0], tutCtx2 = _b[1];
    tutorial2.className = 'tutorial';
    tutCtx2.font = '20px sans-serif';
    tutCtx2.fillStyle = '#ccc';
    tutCtx2.fillText('Isolated cables can overlap others ', 20, 55);
    tutCtx2.drawImage(createIsolatorSprite(80), 358, 10);
    var numResources = resCalls.length;
    var numGenerated = 0;
    (function nextRes() {
        var nextCall = resCalls.shift();
        if (nextCall) {
            nextCall();
            onProgress(100 / numResources * ++numGenerated);
            requestAnimationFrame(nextRes);
        }
        else {
            onDone({
                coils: coilSprites,
                blocks: blockSprites,
                isolators: isolatorSprites,
                greenGlow: greenGlow,
                redGlow: redGlow,
                led: led,
                drag: dragPoint,
                dragGlow: dragGlow,
                finish: finish,
                tutorial1: tutorial1,
                tutorial2: tutorial2,
                start: start
            });
        }
    })();
};
var createSpace = function () {
    var systems = [];
    var entities = [];
    return {
        registerSystem: function (system) {
            systems.push(system);
        },
        addEntity: function (entity) {
            entities.push(entity);
            systems.forEach(function (system) {
                system.addEntity(entity);
            });
        },
        shutdown: function () {
            systems.forEach(function (system) { return system.shutdown && system.shutdown(); });
        },
        entities: entities
    };
};
var calculateTangents = function (attachments) {
    for (var i = 0; i < attachments.length - 1; i++) {
        var a = attachments[i];
        var b = attachments[i + 1];
        var tangents = getTangents(a.entity.pos, a.entity.spool.size, b.entity.pos, b.entity.spool.size);
        var idx = a.side == Side.left ? b.side == Side.left ? 1 : 3 : b.side == Side.left ? 2 : 0;
        if (!tangents[idx]) {
        }
        a.outPos = tangents[idx][0];
        b.inPos = tangents[idx][1];
    }
};
var getIntersections = function (a, b, spoolEntities, ignoreA, ignoreB) {
    return spoolEntities
        .filter(function (spoolEntity) {
        return (spoolEntity != ignoreA && spoolEntity != ignoreB) &&
            lineCircleIntersect(a, b, spoolEntity.pos, spoolEntity.spool.size);
    })
        .sort(function (ca, cb) { return dist2(ca.pos, a) > dist2(cb.pos, a) ? 1 : -1; }); //TODO: need to add the radius
};
var resolveConnections = function (attachments, spools) {
    var resolved;
    do {
        resolved = true;
        for (var i = 0; i < attachments.length - 1; i++) {
            var a = attachments[i];
            var b = attachments[i + 1];
            var entity = getIntersections(a.outPos, b.inPos, spools, a.entity, b.entity)[0];
            if (entity) {
                if (entity.spool.isAttached) {
                    // node already connected
                    a.overlap = true;
                }
                else {
                    // we have a connection
                    entity.spool.isAttached = true;
                    var side = sideOfLine(a.outPos, b.inPos, entity.pos);
                    var attachment = { entity: entity, side: side };
                    attachments.splice(i + 1, 0, attachment);
                    resolved = false;
                    calculateTangents([a, attachment, b]);
                    break;
                }
            }
        }
    } while (!resolved);
};
var resolveDisconnections = function (attachments) {
    var resolved;
    do {
        resolved = true;
        for (var i = 1; i < attachments.length - 1; i++) {
            var a = attachments[i - 1];
            var b = attachments[i];
            var c = attachments[i + 1];
            var vAB = subV(a.outPos, b.inPos);
            var vBC = subV(b.outPos, c.inPos);
            var angle = Math.atan2(vBC.y, vBC.x) - Math.atan2(vAB.y, vAB.x);
            if (angle < 0)
                angle += 2 * Math.PI;
            if ((b.side == Side.left && angle > Math.PI * 1.8) ||
                (b.side == Side.right && angle < Math.PI * 0.2)) {
                attachments.splice(i, 1);
                b.entity.spool.isAttached = false;
                resolved = false;
                calculateTangents([a, c]);
                break;
            }
        }
    } while (!resolved);
};
var createSpoolSystem = function (onLevelCompleted) {
    var spoolEntities = [];
    var blockEntities = [];
    var cables = [];
    var finishEntity;
    var lastPoweredSpools = 0;
    var numSpools = 0;
    return {
        addEntity: function (entity) {
            if (entity.spool) {
                spoolEntities.push(entity);
                if (entity.spool.type == NodeType.spool) {
                    numSpools++;
                    nodeInfo.innerHTML = 0 + ' / ' + numSpools;
                }
            }
            if (entity.cable) {
                cables.push(entity);
            }
            if (entity.block) {
                blockEntities.push(entity);
            }
            if (entity.finish) {
                finishEntity = entity;
            }
        },
        update: function (time) {
            cables.forEach(function (cable) {
                var attachments = cable.cable.attachments;
                // reset states
                cable.cable.overpowered = false;
                attachments.forEach(function (attachment) {
                    attachment.overlap = false;
                });
                spoolEntities.forEach(function (spool) {
                    spool.spool.powered = spool.spool.overpowered = false;
                });
                var numPoweredSpools = 0;
                calculateTangents(attachments);
                resolveConnections(attachments, spoolEntities);
                resolveDisconnections(attachments);
                // set isolated status
                var isIsolated = false;
                cable.cable.attachments.forEach(function (attachment) {
                    var spool = attachment.entity.spool;
                    if (spool.type == NodeType.isolator) {
                        isIsolated = !isIsolated;
                    }
                    attachment.isolated = isIsolated;
                });
                // check line overlap
                for (var i = 0; i < attachments.length - 1; i++) {
                    var a1 = attachments[i];
                    var b1 = attachments[i + 1];
                    if (a1.isolated) {
                        continue;
                    }
                    for (var j = 0; j < attachments.length - 1; j++) {
                        var a2 = attachments[j];
                        var b2 = attachments[j + 1];
                        if (a2.isolated) {
                            continue;
                        }
                        if (lineLineIntersect(a1.outPos, b1.inPos, a2.outPos, b2.inPos)) {
                            a1.overlap = a2.overlap = true;
                        }
                    }
                }
                // check block collision
                for (var i = 0; i < attachments.length - 1; i++) {
                    var a1 = attachments[i];
                    var b1 = attachments[i + 1];
                    for (var j = 0; j < blockEntities.length; j++) {
                        if (lineCircleIntersect(a1.outPos, b1.inPos, blockEntities[j].pos, blockEntities[j].block.size)) {
                            a1.overlap = true;
                            cable.cable.overpowered = true;
                        }
                    }
                }
                // check power / overpower
                var hasPower = true;
                cable.cable.attachments.every(function (attachment) {
                    if (!hasPower) {
                        return false;
                    }
                    if (attachment.isolated && !attachment.overlap) {
                        return true;
                    }
                    if (attachment.entity.spool.powered) {
                        attachment.entity.spool.overpowered = true;
                        cable.cable.overpowered = true;
                        return false;
                    }
                    attachment.entity.spool.powered = true;
                    if (attachment.overlap) {
                        hasPower = false;
                    }
                    else if (attachment.entity.spool.type == NodeType.spool) {
                        numPoweredSpools++;
                    }
                    return true;
                });
                // check if level is completed
                if (hasPower && finishEntity.finish.connected && !cable.cable.overpowered && numPoweredSpools === numSpools) {
                    onLevelCompleted();
                }
                if (numPoweredSpools != lastPoweredSpools) {
                    nodeInfo.innerHTML = numPoweredSpools + ' / ' + numSpools;
                }
                lastPoweredSpools = numPoweredSpools;
            });
        }
    };
};
var Side;
(function (Side) {
    Side[Side["left"] = -1] = "left";
    Side[Side["right"] = 1] = "right";
})(Side || (Side = {}));
var NodeType;
(function (NodeType) {
    NodeType[NodeType["spool"] = 0] = "spool";
    NodeType[NodeType["start"] = 1] = "start";
    NodeType[NodeType["end"] = 2] = "end";
    NodeType[NodeType["block"] = 3] = "block";
    NodeType[NodeType["finish"] = 4] = "finish";
    NodeType[NodeType["isolator"] = 5] = "isolator";
})(NodeType || (NodeType = {}));
// TODO: do i need to differentiate between NodeEntity and Entity?! don't think so, remove NodeEntity
/*
    Start
        HasPosition
        StartNode
        Spool
    End
        HasPosition
        Spool
        MouseEvents
        DragConnector
     Finish
        HasPosition
        FinishNode
     Spool
        HasPosition
        Spool



 */
var nextFrame = requestAnimationFrame;
var startFrameLoop = function (callback) {
    var requestId;
    var stopLoop = false;
    var lastTime = 0;
    var update = function (time) {
        callback(time * 0.001);
        if (!stopLoop) {
            requestId = nextFrame(update);
        }
        lastTime = time;
    };
    requestId = nextFrame(update);
    return function () {
        stopLoop = true;
    };
};
var tween = function (from, to, duration, onUpdate, onComplete) {
    var startTime = performance.now();
    var update = function (time) {
        var t = 1 / duration * (time - startTime) * 0.001;
        if (t < 1) {
            onUpdate(from + (to - from) * t);
            nextFrame(update);
        }
        else {
            onUpdate(to);
            nextFrame(onComplete);
        }
    };
    update(startTime);
};
/// <reference path="types.ts" />
/// <reference path="utils" />
/// <reference path="math-util.ts" />
/// <reference path="html.ts" />
/// <reference path="resources.ts" />
/// <reference path="game.ts" />
var showEndScreen = function () {
    nextMsg.innerHTML = 'Thanks for playing!';
    nextBtn.innerHTML = 'AGAIN';
    showElement(levelDoneElement, function () {
        nextBtn.addEventListener('click', function (e) {
            location.reload();
        });
    });
    saveLevel(0);
};
var startGame = function (parent, resources, startLevel) {
    var game = createGame();
    var currentLevel = startLevel;
    var startNextLevel = function () {
        console.log('start level ' + currentLevel);
        var tutorial;
        if (currentLevel == 0) {
            tutorial = resources.tutorial1;
            gameElement.appendChild(tutorial);
            showElement(tutorial);
        }
        if (currentLevel == 2) {
            tutorial = resources.tutorial2;
            gameElement.appendChild(tutorial);
            showElement(tutorial);
        }
        var level = game.createLevel(gameData.levels[currentLevel], resources, function () {
            if (tutorial) {
                hideElement(tutorial, function () {
                    removeElement(tutorial);
                });
            }
            if (currentLevel < gameData.levels.length - 1) {
                currentLevel++;
                saveLevel(currentLevel);
                hideElement(resetElement);
                showElement([levelDoneElement], function () {
                    nextBtn.onclick = function () {
                        nextBtn.onclick = null;
                        hideElement([levelDoneElement, level.canvas, levelInfo, nodeInfo], function () {
                            removeElement(level.canvas);
                            startNextLevel();
                        });
                    };
                });
            }
            else {
                showEndScreen();
            }
        });
        parent.appendChild(level.canvas);
        levelInfo.innerHTML = 'Level ' + (currentLevel + 1);
        showElement([level.canvas, resetElement, levelInfo, nodeInfo]);
        var resetLevel = function () {
            if (tutorial) {
                hideElement(tutorial, function () {
                    removeElement(tutorial);
                });
            }
            backBtn.onclick = skipBtn.onclick = resetBtn.onclick = null;
            hideElement([level.canvas, resetElement, levelInfo, nodeInfo], function () {
                level.shutdown();
                removeElement(level.canvas);
                startNextLevel();
            });
        };
        resetBtn.onclick = resetLevel;
        skipBtn.onclick = function () {
            if (currentLevel > gameData.levels.length - 2) {
                return;
            }
            currentLevel++;
            resetLevel();
        };
        backBtn.onclick = function () {
            if (currentLevel < 1) {
                return;
            }
            currentLevel--;
            resetLevel();
        };
    };
    startNextLevel();
};
var prepareGame = function () {
    var _a = createCanvas(200, 7), loadingBar = _a[0], context = _a[1];
    loadingBar.id = 'loadingbar';
    loadingElement.appendChild(loadingBar);
    showElement(loadingBar);
    context.strokeStyle = 'grey';
    context.fillStyle = 'grey';
    context.lineWidth = 1;
    context.strokeRect(0.5, 0.5, 199, 4);
    generateResources(function (p) {
        context.fillRect(0.5, 0.5, 199 / 100 * p, 4);
    }, function (resources) {
        hideElement(loadingBar, function () {
            showElement([menuElement, descriptionElement]);
            var savedLevel = loadLevel();
            continueBtn.style.visibility = savedLevel ? 'visible' : 'hidden';
            var hideUIandStartGame = function (startLevel) {
                startBtn.onclick = continueBtn.onclick = null;
                hideElement([titleElement, menuElement, descriptionElement], function () {
                    startGame(contentElement, resources, startLevel);
                });
            };
            startBtn.onclick = function () {
                saveLevel(0);
                hideUIandStartGame(0);
            };
            continueBtn.onclick = function () {
                hideUIandStartGame(savedLevel);
            };
            // hideUIandStartGame(10); // skip main menu and start with level
        });
    });
};
showElement(titleElement, prepareGame);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2NhbnZhcy50cyIsIi4uL3NyYy9nYW1lLnRzIiwiLi4vc3JjL21hdGgtdXRpbC50cyIsIi4uL3NyYy92ZWN0b3IudHMiLCIuLi9zcmMvZ2Z4LWdlbmVyYXRvci50cyIsIi4uL3NyYy9odG1sLnRzIiwiLi4vc3JjL2lucHV0LnRzIiwiLi4vc3JjL2xldmVsLWVkaXRvci50cyIsIi4uL3NyYy9sZXZlbC50cyIsIi4uL3NyYy9tb3VzZS1kcmFnLXN5c3RlbS50cyIsIi4uL3NyYy9yZW5kZXItc3lzdGVtcy50cyIsIi4uL3NyYy9yZXNvdXJjZXMudHMiLCIuLi9zcmMvc3BhY2UudHMiLCIuLi9zcmMvc3Bvb2wtc3lzdGVtLnRzIiwiLi4vc3JjL3R5cGVzLnRzIiwiLi4vc3JjL3V0aWxzLnRzIiwiLi4vc3JjL3N0YXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxJQUFNLFlBQVksR0FBRyxVQUFDLEtBQWEsRUFBRSxNQUFjO0lBQy9DLElBQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDaEQsTUFBTSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7SUFDckIsTUFBTSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7SUFDdkIsSUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQVksQ0FBQztJQUNuRCxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQzdCLENBQUMsQ0FBQztBQ05GLElBQU0sVUFBVSxHQUFHO0lBRWYsSUFBTSxVQUFVLEdBQUcsb0JBQW9CLEVBQUUsQ0FBQztJQUUxQyxJQUFNLFdBQVcsR0FBRyxVQUFDLFNBQW9CLEVBQUUsU0FBb0IsRUFBRSxhQUF5QjtRQUVoRixJQUFBLDRCQUEyQyxFQUExQyxjQUFNLEVBQUUsZUFBTyxDQUE0QjtRQUNsRCxJQUFNLEtBQUssR0FBRyxXQUFX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QUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUExRixDQUEwRixDQUFDO0FDbEdySixxQ0FBcUM7QUFDckMsSUFBTSxLQUFLLEdBQUcsVUFBQyxDQUFRLElBQU0sT0FBQSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBakIsQ0FBaUIsQ0FBQztBQUUvQyxJQUFNLElBQUksR0FBRyxVQUFDLEVBQVEsRUFBRSxFQUFRLElBQVcsT0FBQSxDQUFDLEVBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBbEMsQ0FBa0MsQ0FBQztBQUM5RSxJQUFNLElBQUksR0FBRyxVQUFDLEVBQVEsRUFBRSxFQUFRLElBQVcsT0FBQSxDQUFDLEVBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBbEMsQ0FBa0MsQ0FBQztBQUM5RSxJQUFNLEtBQUssR0FBRyxVQUFDLENBQU8sRUFBRSxDQUFTLElBQVcsT0FBQSxDQUFDLEVBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBQyxDQUFDLEVBQTFCLENBQTBCLENBQUM7QUFDdkUsSUFBTSxLQUFLLEdBQUcsVUFBQyxDQUFPLEVBQUUsQ0FBUyxJQUFXLE9BQUEsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQWYsQ0FBZSxDQUFDO0FBQzVELElBQU0sSUFBSSxHQUFHLFVBQUMsQ0FBTyxJQUFhLE9BQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQWhDLENBQWdDLENBQUM7QUFDbkUsSUFBTSxLQUFLLEdBQUcsVUFBQyxFQUFRLEVBQUUsRUFBUSxJQUFhLE9BQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBbEIsQ0FBa0IsQ0FBQztBQUNqRSxJQUFNLFVBQVUsR0FBRyxVQUFDLENBQU8sSUFBVyxPQUFBLEtBQUssQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUF0QixDQUFzQixDQUFDO0FBQzdELElBQU0sU0FBUyxHQUFHLFVBQUMsQ0FBTyxJQUFLLE9BQUEsQ0FBQyxFQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxFQUFuQixDQUFtQixDQUFDO0FBQ25ELElBQU0sVUFBVSxHQUFHLFVBQUMsQ0FBTyxJQUFLLE9BQUEsQ0FBQyxFQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxFQUFuQixDQUFtQixDQUFDO0FBQ3BELElBQU0sTUFBTSxHQUFHLFVBQUMsQ0FBTztJQUNuQixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2pDLElBQUksS0FBSyxHQUFHLENBQUM7UUFBRSxLQUFLLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUM7SUFDcEMsT0FBTyxLQUFLLENBQUM7QUFDakIsQ0FBQyxDQUFDO0FBQ0YsSUFBTSxTQUFTLEdBQUcsVUFBQyxNQUFZLEVBQUUsTUFBWTtJQUN6QyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDcEIsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQ3hCLENBQUMsQ0FBQztBQUNGLElBQU0sS0FBSyxHQUFHLFVBQUMsTUFBWSxJQUFXLE9BQUEsQ0FBQyxFQUFDLENBQUMsRUFBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBM0IsQ0FBMkIsQ0FBQztBQUNsRSxJQUFNLE1BQU0sR0FBRyxVQUFDLENBQU8sSUFBSyxPQUFBLENBQUMsRUFBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLEVBQWhDLENBQWdDLENBQUM7QUFDN0QsSUFBTSxNQUFNLEdBQUcsVUFBQyxDQUFPLElBQUssT0FBQSxDQUFDLEVBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLEVBQXRCLENBQXNCLENBQUM7QUN2Qm5ELGtDQUFrQztBQUNsQyxrQ0FBa0M7QUFFbEMsSUFBTSxHQUFHLEdBQUcsVUFBQyxDQUFTLEVBQUUsQ0FBUyxFQUFFLENBQVMsSUFBSyxPQUFBLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFuQixDQUFtQixDQUFDO0FBQ3JFLElBQU0sTUFBTSxHQUFHLFVBQUMsQ0FBUSxFQUFFLENBQVEsRUFBRSxDQUFTLElBQVksT0FBQSxDQUFDO0lBQ3RELENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNuQixDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDbkIsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ25CLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztDQUN0QixDQUFDLEVBTHVELENBS3ZELENBQUM7QUFFSCxJQUFNLEtBQUssR0FBRyxFQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBQyxDQUFDO0FBQy9CLElBQU0sR0FBRyxHQUFHLEVBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFDLENBQUM7QUFDekIsSUFBTSxHQUFHLEdBQUcsRUFBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUMsQ0FBQztBQUN6QixJQUFNLEdBQUcsR0FBRyxFQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBQyxDQUFDO0FBQ3pCLElBQU0sR0FBRyxHQUFHLFVBQUMsQ0FBTyxJQUFhLE9BQUEsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQWxELENBQWtELENBQUM7QUFFcEYsSUFBTSxLQUFLLEdBQUcsVUFBQyxDQUFPO0lBQ2xCLElBQU0sRUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNyQixJQUFNLEVBQUUsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDckIsSUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ25CLElBQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDOUIsSUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTVCLElBQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDOUIsSUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUU5QixJQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFNUIsT0FBTyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDM0IsQ0FBQyxDQUFDO0FBQ0YsSUFBTSxVQUFVLEdBQUcsVUFBQyxHQUFXLEVBQUUsR0FBVyxFQUFFLEtBQWE7SUFDdkQsSUFBTSxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNuRCxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQy9CLENBQUMsQ0FBQztBQUNGLElBQU0sTUFBTSxHQUFHLFVBQUMsQ0FBYSxFQUFFLENBQWEsRUFBRSxDQUFhLEVBQUUsQ0FBYTtJQUExRCxrQkFBQSxFQUFBLEtBQWE7SUFBRSxrQkFBQSxFQUFBLEtBQWE7SUFBRSxrQkFBQSxFQUFBLEtBQWE7SUFBRSxrQkFBQSxFQUFBLEtBQWE7SUFBWSxPQUFBLENBQUMsRUFBQyxDQUFDLEdBQUEsRUFBRSxDQUFDLEdBQUEsRUFBRSxDQUFDLEdBQUEsRUFBRSxDQUFDLEdBQUEsRUFBQyxDQUFDO0FBQWQsQ0FBYyxDQUFDO0FBQ3JHLElBQU0sTUFBTSxHQUFHLFVBQUMsS0FBWSxFQUFFLENBQVMsSUFBSyxPQUFBLENBQUM7SUFDekMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQztJQUNkLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUM7SUFDZCxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDO0lBQ2QsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0NBQ2IsQ0FBQyxFQUwwQyxDQUsxQyxDQUFDO0FBRUgsSUFBTSxNQUFNLEdBQUcsVUFBQyxDQUFRLEVBQUUsQ0FBUTtJQUM5QixPQUFPO1FBQ0gsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNsQixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2xCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbEIsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7S0FDZixDQUFDO0FBQ04sQ0FBQyxDQUFDO0FBQ0YsSUFBTSxhQUFhLEdBQUcsVUFBQyxLQUFhLEVBQUUsTUFBYyxFQUFFLEVBQXNCO0lBQ2xFLElBQUEsZ0NBQStDLEVBQTlDLGNBQU0sRUFBRSxlQUFPLENBQWdDO0lBQ3RELElBQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDNUQsSUFBTSxHQUFHLEdBQUcsSUFBSSxXQUFXLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNuRCxJQUFNLElBQUksR0FBRyxJQUFJLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3hDLElBQU0sTUFBTSxHQUFHLElBQUksV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3BDLElBQU0sQ0FBQyxHQUFrQixFQUFFLENBQUM7SUFFNUIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUM3QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzVCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ3RCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLElBQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFTLENBQUMsQ0FBQztZQUN4QixNQUFNLENBQUMsQ0FBQyxHQUFHLEtBQUssR0FBRyxDQUFDLENBQUM7Z0JBQ2pCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFFLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBTSxRQUFRO29CQUMvQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBRSxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLEdBQU0sT0FBTztvQkFDOUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUUsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFNLFFBQVE7b0JBQzlDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBRSxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7U0FDakM7S0FDSjtJQUNELFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3pCLE9BQU8sQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUV0QyxPQUFPLE1BQU0sQ0FBQztBQUNsQixDQUFDLENBQUM7QUFFRiwwQ0FBMEM7QUFDMUMsSUFBTSxjQUFjLEdBQUcsVUFBQyxDQUFPLEVBQUUsS0FBYTtJQUN0QyxJQUFBLG9CQUF3QixFQUF2QixRQUFDLEVBQUUsUUFBQyxDQUFvQjtJQUM3QixDQUFDLElBQUksT0FBTyxHQUFHLEdBQUcsQ0FBQztJQUNuQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztJQUMvQixDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQzFCLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7SUFDMUIsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQzFELENBQUMsQ0FBQztBQUVGLElBQU0sZ0JBQWdCLEdBQUcsVUFBQyxDQUFTLEVBQUUsQ0FBUztJQUMxQyxJQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN0RSxDQUFDLElBQUksT0FBTyxDQUFDO0lBQ2IsT0FBTyxHQUFHLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1VBQzFELENBQUMsS0FBSyxDQUFDLEVBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxPQUFPLEdBQUcsR0FBRyxDQUFDO0FBQzdFLENBQUMsQ0FBQztBQUVGLElBQU0sZ0JBQWdCLEdBQUcsVUFBQyxJQUFZO0lBQ2xDLElBQU0sRUFBRSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUM7SUFDcEIsSUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQztJQUMvQixJQUFNLGtCQUFrQixHQUFHLEdBQUcsQ0FBQztJQUMvQixJQUFNLGNBQWMsR0FBRyxHQUFHLENBQUM7SUFDM0IsSUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDO0lBQzNCLElBQU0sa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO0lBQzdCLElBQU0sU0FBUyxHQUFHLEdBQUcsQ0FBQztJQUN0QixJQUFNLFVBQVUsR0FBRyxHQUFHLENBQUM7SUFDdkIsSUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzdDLElBQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN0QyxJQUFNLFVBQVUsR0FBRyxHQUFHLENBQUM7SUFDdkIsSUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDO0lBQzVCLElBQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQztJQUN4QixJQUFNLGNBQWMsR0FBRyxHQUFHLENBQUM7SUFFM0IsSUFBTSxLQUFLLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxFQUFFLFVBQUEsQ0FBQztRQUN6RSxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLGdDQUFnQztRQUNuRCxJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQy9CLElBQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDM0MsSUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM1QixJQUFJLElBQUksR0FBRyxrQkFBa0IsR0FBRyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsY0FBYyxDQUFDLENBQUMsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsa0JBQWtCO1FBQzVHLElBQU0sVUFBVSxHQUFHLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsU0FBUyxHQUFHLElBQUksRUFBRSxDQUFDLEdBQUcsU0FBUyxHQUFHLGNBQWMsRUFBRSxDQUFDLENBQUM7WUFDdkYsVUFBVSxDQUFDLFVBQVUsR0FBRyxjQUFjLEVBQUUsVUFBVSxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ25FLElBQUksSUFBSSxDQUFDLFVBQVUsR0FBRyxrQkFBa0IsQ0FBQyxDQUFDO1FBRTFDLElBQU0sVUFBVSxHQUFHLGdCQUFnQixDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxjQUFjLENBQUM7UUFDM0QsSUFBTSxRQUFRLEdBQUcsVUFBVSxDQUFDLENBQUMsR0FBRyxTQUFTLEVBQUUsQ0FBQyxHQUFHLFNBQVMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLFVBQVUsRUFBRSxVQUFVLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQy9HLElBQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxFQUFFLE1BQU0sQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFFNUYsSUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsVUFBVSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQzVELENBQUMsRUFBRSxjQUFjO1lBQ2pCLENBQUMsRUFBRSxjQUFjO1NBQ3BCLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxXQUFXLENBQUMsR0FBRyxjQUFjLENBQUM7UUFDeEMsSUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRTFDLE9BQU8sTUFBTSxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEUsQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPLEtBQUssQ0FBQztBQUVqQixDQUFDLENBQUM7QUFFRixJQUFNLG9CQUFvQixHQUFHLFVBQUMsSUFBWTtJQUN0QyxJQUFNLEVBQUUsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDO0lBQ3BCLElBQU0sYUFBYSxHQUFHLElBQUksR0FBRyxDQUFDLENBQUM7SUFDL0IsSUFBTSxrQkFBa0IsR0FBRyxHQUFHLENBQUM7SUFDL0IsSUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDO0lBQzNCLElBQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQztJQUMzQixJQUFNLGtCQUFrQixHQUFHLEdBQUcsQ0FBQztJQUMvQixJQUFNLFNBQVMsR0FBRyxJQUFJLENBQUM7SUFDdkIsSUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDO0lBQ3ZCLElBQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWM7SUFDOUQsSUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3RDLElBQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQztJQUN2QixJQUFNLGNBQWMsR0FBRyxJQUFJLENBQUM7SUFDNUIsSUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDO0lBQ3hCLElBQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQztJQUUzQixJQUFNLEtBQUssR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLEVBQUUsVUFBQSxDQUFDO1FBQ3pFLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsZ0NBQWdDO1FBQ25ELElBQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDL0IsSUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVU7UUFDdEQsSUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFnQixVQUFVO1FBQ3RELElBQUksSUFBSSxHQUFHLGtCQUFrQixHQUFHLFVBQVUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsR0FBRyxjQUFjLENBQUMsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxvQkFBb0I7UUFDbEgsSUFBTSxVQUFVLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxTQUFTLEdBQUcsSUFBSSxFQUFFLENBQUMsR0FBRyxTQUFTLEdBQUcsY0FBYyxFQUFFLENBQUMsQ0FBQztZQUN2RixVQUFVLENBQUMsVUFBVSxHQUFHLGNBQWMsRUFBRSxVQUFVLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbkUsSUFBSSxJQUFJLENBQUMsVUFBVSxHQUFHLGtCQUFrQixDQUFDLENBQUM7UUFFMUMsSUFBTSxVQUFVLEdBQUcsZ0JBQWdCLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLGNBQWMsQ0FBQztRQUMzRCxJQUFNLFFBQVEsR0FBRyxVQUFVLENBQUMsQ0FBQyxHQUFHLFNBQVMsRUFBRSxDQUFDLEdBQUcsU0FBUyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsVUFBVSxFQUFFLFVBQVUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDL0csSUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLEVBQUUsTUFBTSxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUU1RixJQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxVQUFVLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDNUQsQ0FBQyxFQUFFLGNBQWM7WUFDakIsQ0FBQyxFQUFFLGNBQWM7U0FDcEIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxHQUFHLGNBQWMsQ0FBQztRQUN4QyxJQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFMUMsT0FBTyxNQUFNLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsRSxDQUFDLENBQUMsQ0FBQztJQUVILE9BQU8sS0FBSyxDQUFDO0FBRWpCLENBQUMsQ0FBQztBQUVGLElBQU0sVUFBVSxHQUFHLFVBQUMsRUFBUyxFQUFFLEVBQVMsRUFBRSxTQUFpQixFQUFFLFNBQWdCLEVBQUUsSUFBWTtJQUN2RixJQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2pELElBQU0sTUFBTSxHQUFHLFVBQVUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxHQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDN0MsSUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLFNBQVMsRUFBRSxTQUFTLEdBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUM3RCxJQUFNLEdBQUcsR0FBRyxVQUFVLENBQUMsU0FBUyxHQUFDLElBQUksRUFBQyxTQUFTLEVBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQzFELE9BQU8sS0FBSyxDQUFDLE1BQU0sR0FBRSxNQUFNLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQztBQUM1QyxDQUFDLENBQUM7QUFFRixJQUFNLGlCQUFpQixHQUFHLFVBQUMsSUFBWTtJQUNuQyxJQUFNLEtBQUssR0FBRyxhQUFhLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxVQUFBLENBQUM7UUFDckMsSUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMxQixJQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLElBQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEMsSUFBTSxFQUFFLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBSSxrQkFBa0I7UUFDNUQsSUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFJLGtCQUFrQjtRQUM3RSxJQUFNLFNBQVMsR0FBRyxTQUFTLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUMsSUFBSSxHQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3BELElBQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBQyxJQUFJLEdBQUMsR0FBRyxDQUFDLENBQUM7UUFDdkMsSUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQzNELElBQUksVUFBVSxHQUFHLFVBQVUsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDO1FBQzFELElBQUksTUFBTSxHQUFHLENBQUMsR0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN2QyxJQUFJLEtBQUssR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLFVBQVUsR0FBRyxHQUFHLENBQUM7UUFDdkMsSUFBSSxJQUFJLEdBQUcsVUFBVSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUMvQyxJQUFJLE9BQU8sR0FBRyxHQUFHLEdBQUMsR0FBRyxHQUFDLGdCQUFnQixDQUFDLElBQUksR0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDbEQsS0FBSyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxVQUFVLENBQUMsRUFBRSxJQUFJLEdBQUMsR0FBRyxHQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNwRSxPQUFPLE1BQU0sQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxVQUFVLEdBQUMsQ0FBQyxDQUFDLEdBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUM5RCxDQUFDLENBQUMsQ0FBQztJQUNILE9BQU8sS0FBSyxDQUFDO0FBRWpCLENBQUMsQ0FBQztBQUVGLElBQU0saUJBQWlCLEdBQUcsVUFBQyxDQUFPO0lBQzlCLElBQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDdEIsSUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQy9DLElBQU0sR0FBRyxHQUFHLFVBQVUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEVBQUUsR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7SUFDL0MsSUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDakMsT0FBTyxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDcEMsQ0FBQyxDQUFDO0FBQ0YsSUFBTSxjQUFjLEdBQUcsVUFBQyxDQUFPO0lBQzNCLElBQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztJQUM5QixJQUFNLEdBQUcsR0FBRyxVQUFVLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7SUFDekMsSUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDbkMsT0FBTyxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDcEMsQ0FBQyxDQUFDO0FBQ0YsSUFBTSx3QkFBd0IsR0FBRyxVQUFDLENBQU87SUFDckMsSUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDO0lBQzlCLElBQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztJQUNsRCxJQUFNLEdBQUcsR0FBRyxVQUFVLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDN0IsVUFBVSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDN0IsT0FBTyxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDdEMsQ0FBQyxDQUFDO0FBQ0YsSUFBTSxlQUFlLEdBQUcsY0FBYyxPQUFBLGFBQWEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLFVBQUEsQ0FBQztJQUN6RCxJQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzFCLElBQU0sV0FBVyxHQUFHLGlCQUFpQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQzFDLElBQU0sUUFBUSxHQUFHLGNBQWMsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNwQyxJQUFNLGtCQUFrQixHQUFHLHdCQUF3QixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBRXhELE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsUUFBUSxDQUFDLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztBQUNyRSxDQUFDLENBQUMsRUFQb0MsQ0FPcEMsQ0FBQztBQUVILElBQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNqQyxJQUFNLFVBQVUsR0FBRyxVQUFDLEtBQVcsSUFBYSxPQUFBLGFBQWEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLFVBQUEsQ0FBQztJQUMvRCxJQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzFCLElBQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzNCLElBQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLFVBQVUsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFOUQsSUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDaEMsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQztBQUN2RCxDQUFDLENBQUMsRUFQMEMsQ0FPMUMsQ0FBQztBQUVILElBQU0sV0FBVyxHQUFHLFVBQUMsQ0FBUyxFQUFFLENBQVM7SUFDckMsT0FBTyxHQUFHLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1VBQzFELENBQUMsS0FBSyxDQUFDLEVBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQztBQUM3RCxDQUFDLENBQUM7QUFFRixJQUFNLGNBQWMsR0FBRyxVQUFDLEtBQVcsSUFBYSxPQUFBLGFBQWEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLFVBQUEsQ0FBQztJQUNuRSxJQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzFCLElBQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzNCLElBQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLFVBQVUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdkYsSUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDeEQsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQztBQUN2RCxDQUFDLENBQUMsRUFOOEMsQ0FNOUMsQ0FBQztBQUdILElBQU0sc0JBQXNCLEdBQUcsVUFBQyxVQUFnQixFQUFFLElBQVc7SUFDekQsSUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDO0lBQ3ZCLElBQU0sY0FBYyxHQUFHLElBQUksQ0FBQztJQUM1QixJQUFNLFdBQVcsR0FBRyxHQUFHLENBQUM7SUFDeEIsSUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDO0lBQzNCLElBQU0sS0FBSyxHQUFHLGFBQWEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFVBQUEsQ0FBQztRQUNyQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLGdDQUFnQztRQUNuRCxJQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRTFCLElBQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEMsSUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUV4QixPQUFPO1FBQ1AsSUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDekMsSUFBSSxPQUFPLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEdBQUMsR0FBRyxHQUFDLEdBQUcsQ0FBQztRQUNoRCxPQUFPLElBQUksVUFBVSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDO1FBQ3ZFLElBQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxJQUFJLEdBQUMsQ0FBQyxPQUFPLEdBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsT0FBTyxDQUFDO1FBQzVELElBQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQztRQUU3RCxRQUFRO1FBQ1IsSUFBTSxVQUFVLEdBQUcsVUFBVSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEdBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFekUsSUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDcEQsSUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsVUFBVSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFO1lBQ3ZELENBQUMsRUFBRSxjQUFjO1lBQ2pCLENBQUMsRUFBRSxjQUFjO1NBQ3BCLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxXQUFXLENBQUMsR0FBRyxjQUFjLENBQUM7UUFDeEMsSUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzFDLE9BQU8sTUFBTSxDQUFDLEdBQUcsRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMxRCxDQUFDLENBQUMsQ0FBQztJQUNILE9BQU8sS0FBSyxDQUFDO0FBQ2pCLENBQUMsQ0FBQztBQUVGLElBQU0sb0JBQW9CLEdBQUc7SUFDbkIsSUFBQSw2QkFBNEMsRUFBM0MsY0FBTSxFQUFFLGVBQU8sQ0FBNkI7SUFDbkQsSUFBTSxLQUFLLEdBQUcsYUFBYSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsVUFBQSxDQUFDO1FBQ2pDLElBQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDdEIsSUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBQyxHQUFHLENBQUM7UUFDM0QsT0FBTyxNQUFNLENBQUMsR0FBRyxHQUFHLEtBQUssRUFBRSxHQUFHLEdBQUcsS0FBSyxFQUFFLEdBQUcsR0FBRyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDNUQsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFNLFNBQVMsR0FBRyxhQUFhLENBQUMsR0FBRyxHQUFDLENBQUMsRUFBRSxFQUFFLEdBQUMsQ0FBQyxFQUFFLFVBQUEsQ0FBQztRQUMxQyxJQUFNLENBQUMsR0FBRyxJQUFJLENBQUM7UUFDZixJQUFNLENBQUMsR0FBRyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFDLENBQUMsR0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzRCxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVsRCxPQUFPLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsR0FBQyxJQUFJLENBQUMsQ0FBQztJQUN2QyxDQUFDLENBQUMsQ0FBQztJQUVILEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDekIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUN6QixPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztTQUM1QztLQUNKO0lBRUQsT0FBTyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDOUMsT0FBTyxNQUFNLENBQUM7QUFDbEIsQ0FBQyxDQUFDO0FDL1RGLElBQU0sV0FBVyxHQUFHLFVBQUMsRUFBTyxJQUFLLE9BQUEsUUFBUSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUMsRUFBM0IsQ0FBMkIsQ0FBQztBQUU3RCxJQUFNLFlBQVksR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFnQixDQUFDO0FBQ3pELElBQU0sV0FBVyxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQWdCLENBQUM7QUFDdkQsSUFBTSxjQUFjLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBZ0IsQ0FBQztBQUM3RCxJQUFNLFdBQVcsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFnQixDQUFDO0FBQ3ZELElBQU0sZ0JBQWdCLEdBQUcsV0FBVyxDQUFDLFdBQVcsQ0FBZ0IsQ0FBQztBQUNqRSxJQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFnQixDQUFDO0FBQ3RELElBQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQWdCLENBQUM7QUFDdEQsSUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLFVBQVUsQ0FBZ0IsQ0FBQztBQUN4RCxJQUFNLFdBQVcsR0FBRyxXQUFXLENBQUMsYUFBYSxDQUFnQixDQUFDO0FBQzlELElBQU0sY0FBYyxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQWdCLENBQUM7QUFDN0QsSUFBTSxZQUFZLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBZ0IsQ0FBQztBQUN6RCxJQUFNLFFBQVEsR0FBRyxXQUFXLENBQUMsVUFBVSxDQUFnQixDQUFDO0FBQ3hELElBQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyxXQUFXLENBQWdCLENBQUM7QUFDMUQsSUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLFVBQVUsQ0FBZ0IsQ0FBQztBQUN4RCxJQUFNLGtCQUFrQixHQUFHLFdBQVcsQ0FBQyxhQUFhLENBQWdCLENBQUM7QUFFckUsSUFBTSxPQUFPLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBZ0IsQ0FBQztBQUN0RCxJQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFnQixDQUFDO0FBRXRELElBQU0sU0FBUyxHQUFHLFVBQUMsS0FBYTtJQUM1QixJQUFJO1FBQ0EsWUFBWSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsRUFBRSxHQUFHLEtBQUssQ0FBQyxDQUFDO0tBQzdDO0lBQUMsT0FBTyxDQUFDLEVBQUU7UUFDUix5RUFBeUU7S0FDNUU7QUFDTCxDQUFDLENBQUM7QUFFRixJQUFNLFNBQVMsR0FBRztJQUNkLElBQUk7UUFDQSxPQUFPLFFBQVEsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ3hEO0lBQUMsT0FBTyxDQUFDLEVBQUU7UUFDUixPQUFPLENBQUMsQ0FBQztLQUNaO0FBQ0wsQ0FBQyxDQUFDO0FBRUYsSUFBTSxhQUFhLEdBQUcsVUFBQyxPQUFvQjtJQUN2QyxPQUFPLENBQUMsVUFBVyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUM3QyxDQUFDLENBQUM7QUFFRixJQUFNLFFBQVEsR0FBRyxHQUFHLENBQUM7QUFFckIsSUFBTSxXQUFXLEdBQUcsVUFBQyxPQUFvQyxFQUFFLFVBQXVCO0lBQzlFLElBQUksUUFBUSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM1RCxRQUFRLENBQUMsT0FBTyxDQUFDLFVBQUEsQ0FBQztRQUNkLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLFNBQVMsQ0FBQztRQUMvQixDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxHQUFHLENBQUM7SUFDMUIsQ0FBQyxDQUFDLENBQUM7SUFDSCxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQ2hCLFVBQUMsQ0FBQztRQUNFLFFBQVEsQ0FBQyxPQUFPLENBQUMsVUFBQSxDQUFDO1lBQ2QsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ25DLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQyxFQUNEO1FBQ0ksVUFBVSxJQUFJLFVBQVUsRUFBRSxDQUFDO0lBQy9CLENBQUMsQ0FDSixDQUFDO0FBQ04sQ0FBQyxDQUFDO0FBRUYsSUFBTSxXQUFXLEdBQUcsVUFBQyxPQUFvQyxFQUFFLFVBQXVCO0lBQzlFLElBQUksUUFBUSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM1RCxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQ2hCLFVBQUMsQ0FBQztRQUNFLFFBQVEsQ0FBQyxPQUFPLENBQUMsVUFBQSxDQUFDO1lBQ2QsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ25DLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQyxFQUNEO1FBQ0ksUUFBUSxDQUFDLE9BQU8sQ0FBQyxVQUFBLENBQUM7WUFDZCxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxRQUFRLENBQUM7UUFDbEMsQ0FBQyxDQUFDLENBQUM7UUFDSCxVQUFVLElBQUksVUFBVSxFQUFFLENBQUM7SUFDL0IsQ0FBQyxDQUNKLENBQUM7QUFDTixDQUFDLENBQUM7QUN0REYsSUFBTSxrQkFBa0IsR0FBRyxVQUFDLE1BQWM7SUFDdEMsSUFBSSxTQUFTLEdBQVksS0FBSyxDQUFDO0lBQy9CLElBQU0sUUFBUSxHQUFTLEVBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFDLENBQUM7SUFFcEMsSUFBTSxnQkFBZ0IsR0FBd0MsRUFBRSxDQUFDO0lBQ2pFLElBQU0sZUFBZSxHQUF3QyxFQUFFLENBQUM7SUFDaEUsSUFBTSxnQkFBZ0IsR0FBd0MsRUFBRSxDQUFDO0lBRWpFLElBQU0saUJBQWlCLEdBQUcsVUFBQyxDQUFhO1FBQ3BDLElBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBQzFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ25DLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO1FBQ2xDLENBQUMsQ0FBQyxjQUFjLEVBQUUsQ0FBQztJQUN2QixDQUFDLENBQUM7SUFDRixJQUFNLGlCQUFpQixHQUFHLFVBQUMsQ0FBYTtRQUNwQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxVQUFBLEtBQUs7WUFDMUIsSUFBTSxpQkFBaUIsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQzdDLGlCQUFpQixJQUFJLGlCQUFpQixFQUFFLENBQUM7WUFDekMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2pDLENBQUMsQ0FBQyxDQUFDO1FBQ0gsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO0lBQ3ZCLENBQUMsQ0FBQztJQUNGLElBQU0sZUFBZSxHQUFHLFVBQUMsQ0FBYTtRQUNsQyxTQUFTLEdBQUcsS0FBSyxDQUFDO1FBQ2xCLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxVQUFBLEtBQUs7WUFDMUIsSUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztZQUN6QyxlQUFlLElBQUksZUFBZSxFQUFFLENBQUM7UUFDekMsQ0FBQyxDQUFDLENBQUM7UUFDSCxnQkFBZ0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQ2hDLENBQUMsQ0FBQztJQUVGLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztJQUMxRCxRQUFRLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLGlCQUFpQixDQUFDLENBQUM7SUFDMUQsUUFBUSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxlQUFlLENBQUMsQ0FBQztJQUV0RCxJQUFNLFdBQVcsR0FBRyxVQUFDLE1BQXVCLEVBQUUsU0FBeUI7UUFDbkUsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBQzlDLENBQUMsQ0FBQztJQUVGLElBQU0sTUFBTSxHQUFHO1FBQ1gsS0FBSyxJQUFJLENBQUMsR0FBRyxlQUFlLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFO1lBQ2xELElBQU0sS0FBSyxHQUFHLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNqQyxJQUFNLFNBQVMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0IsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRTtnQkFDMUQsU0FBUyxDQUFDLFNBQVMsSUFBSSxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQzdDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUM3QixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7YUFDaEM7U0FDSjtRQUNELEtBQUssSUFBSSxDQUFDLEdBQUcsZ0JBQWdCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFO1lBQ25ELElBQU0sS0FBSyxHQUFHLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2xDLElBQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUUzQixTQUFTLElBQUksU0FBUyxDQUFDLGVBQWUsSUFBSSxTQUFTLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDdEUsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRTtnQkFDekQsU0FBUyxDQUFDLFFBQVEsSUFBSSxTQUFTLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQzNDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQzlCLGVBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7YUFDL0I7U0FDSjtJQUNMLENBQUMsQ0FBQztJQUNGLElBQU0sUUFBUSxHQUFHO1FBQ2IsUUFBUSxDQUFDLG1CQUFtQixDQUFDLFdBQVcsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1FBQzdELFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztRQUM3RCxRQUFRLENBQUMsbUJBQW1CLENBQUMsU0FBUyxFQUFFLGVBQWUsQ0FBQyxDQUFDO0lBQzdELENBQUMsQ0FBQztJQUVGLE9BQU87UUFDSCxNQUFNLFFBQUE7UUFDTixXQUFXLGFBQUE7UUFDWCxRQUFRLFVBQUE7UUFDUixXQUFXLEVBQUUsY0FBTSxPQUFBLENBQUMsU0FBUyxDQUFDLEVBQVgsQ0FBVztRQUM5QixRQUFRLFVBQUE7UUFDUixPQUFPLEVBQUMsZ0JBQWdCO0tBQzNCLENBQUM7QUFDTixDQUFDLENBQUM7QUNuR0YsSUFBTSx1QkFBdUIsR0FBRyxVQUFDLEtBQVksRUFBRSxZQUEwQjtJQUNyRSxJQUFNLGtCQUFrQixHQUFHLFVBQUMsQ0FBYTtRQUNyQyxDQUFDLENBQUMsY0FBYyxFQUFFLENBQUM7UUFDbkIsSUFBTSxLQUFLLEdBQUksWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQVksQ0FBQyxLQUFLLElBQUssWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQVksQ0FBQyxLQUFLLENBQUM7UUFFM0csSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNSLE9BQU87U0FDVjtRQUNELElBQUksR0FBRyxHQUFHLEVBQUUsQ0FBQztRQUNiLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUNkLElBQUksS0FBSyxDQUFDLElBQUksSUFBSSxRQUFRLENBQUMsUUFBUSxFQUFFO1lBQ2pDLEdBQUcsR0FBRyxFQUFFLENBQUM7U0FDWjtRQUVELElBQUksQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDZCxLQUFLLENBQUMsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLENBQUM7U0FDNUM7YUFBTTtZQUNILEtBQUssQ0FBQyxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQztTQUM1QztJQUNMLENBQUMsQ0FBQztJQUVGLElBQU0sZUFBZSxHQUFHLFVBQUMsQ0FBZ0I7UUFDckMsSUFBSSxDQUFDLENBQUMsR0FBRyxLQUFLLEdBQUcsRUFBRTtZQUNmLElBQU0sV0FBVyxHQUFvQjtnQkFDakMsR0FBRyxFQUFFLEVBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUM7Z0JBQ2pFLEtBQUssRUFBRSxFQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLLEVBQUM7Z0JBQ3ZDLE1BQU0sRUFBRSxFQUFDLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSyxFQUFDO2FBQ2pDLENBQUM7WUFDRiwrQ0FBK0M7WUFDL0MsS0FBSyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQztTQUNoQztRQUNELElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxHQUFHLEVBQUU7WUFDZixJQUFNLFdBQVcsR0FBb0I7Z0JBQ2pDLEdBQUcsRUFBRSxFQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUM7Z0JBQzdELEtBQUssRUFBRSxFQUFDLElBQUksRUFBRSxFQUFFLEVBQUM7Z0JBQ2pCLE1BQU0sRUFBRSxFQUFDLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSyxFQUFDO2FBQ2pDLENBQUM7WUFDRiwrQ0FBK0M7WUFDL0MsS0FBSyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQztTQUNoQztRQUNELElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxHQUFHLEVBQUU7WUFDZixJQUFNLFdBQVcsR0FBb0I7Z0JBQ2pDLEdBQUcsRUFBRSxFQUFDLENBQUMsRUFBRSxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUM7Z0JBQzdELEtBQUssRUFBRSxFQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxRQUFRLEVBQUM7Z0JBQzFDLE1BQU0sRUFBRSxFQUFDLElBQUksRUFBRSxRQUFRLENBQUMsUUFBUSxFQUFDO2FBQ3BDLENBQUM7WUFDRiwrQ0FBK0M7WUFDL0MsS0FBSyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQztTQUNoQztRQUNELElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxJQUFJLEVBQUU7WUFDaEIsSUFBTSxPQUFLLEdBQXVCLEVBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUMsQ0FBQztZQUMxRSxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxVQUFBLE1BQU07Z0JBQ3pCLElBQUksTUFBTSxDQUFDLEtBQUssRUFBRTtvQkFDZCxRQUFRLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFO3dCQUN2QixLQUFLLFFBQVEsQ0FBQyxLQUFLOzRCQUNmLE9BQUssQ0FBQyxNQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUksQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUksQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDOzRCQUN0RSxNQUFNO3dCQUNWLEtBQUssUUFBUSxDQUFDLEtBQUs7NEJBQ2YsT0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFJLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7NEJBQzdDLE1BQU07d0JBQ1YsS0FBSyxRQUFRLENBQUMsR0FBRzs0QkFDYixPQUFLLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDOzRCQUN2QixNQUFNO3dCQUNWLEtBQUssUUFBUSxDQUFDLFFBQVE7NEJBQ2xCLE9BQUssQ0FBQyxTQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUksQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUksQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEtBQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDOzRCQUMxRSxNQUFNO3FCQUNiO2lCQUNKO2dCQUNELElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtvQkFDZixPQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUksQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztpQkFDakQ7Z0JBQ0QsSUFBSSxNQUFNLENBQUMsS0FBSyxFQUFFO29CQUNkLE9BQUssQ0FBQyxNQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUksQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUksQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2lCQUN6RTtZQUNMLENBQUMsQ0FBQyxDQUFDO1lBRUgsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQUssQ0FBQyxDQUFDLENBQUM7U0FDdEM7SUFDTCxDQUFDLENBQUM7SUFFRixNQUFNLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLGVBQWUsQ0FBQyxDQUFDO0lBQ3BELE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztJQUVyRCxPQUFPO1FBQ0gsU0FBUyxFQUFFLFVBQUEsTUFBTTtZQUNiLElBQUksTUFBTSxDQUFDLEtBQUssRUFBRTtnQkFDZCxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLFFBQVEsQ0FBQyxHQUFHLEVBQUU7b0JBQ25DLE1BQU0sQ0FBQyxTQUFTLEdBQUcsRUFBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUMsQ0FBQztpQkFDaEQ7YUFFSjtZQUNELElBQUksTUFBTSxDQUFDLEtBQUssRUFBRTtnQkFDZCxNQUFNLENBQUMsU0FBUyxHQUFHLEVBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFDLENBQUM7YUFDaEQ7UUFDTCxDQUFDO1FBQ0QsTUFBTSxFQUFFLFVBQUMsSUFBWTtRQUNyQixDQUFDO1FBQ0QsUUFBUSxFQUFFO1lBQ04sTUFBTSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxlQUFlLENBQUMsQ0FBQztRQUMzRCxDQUFDO0tBQ0osQ0FBQztBQUNOLENBQUMsQ0FBQztBQ3pGRixJQUFNLFFBQVEsR0FBYTtJQUN2QixNQUFNLEVBQUU7UUFDSixvQkFBb0I7UUFDcEIsbURBQW1EO1FBQ25ELHVCQUF1QjtRQUN2QixvQkFBb0I7UUFDcEIsMEJBQTBCO1FBQzFCLDZCQUE2QjtRQUM3Qix3QkFBd0I7UUFDeEIsSUFBSTtRQUNKLElBQUk7UUFDSjtZQUNJLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDMUMsV0FBVyxFQUFFLEVBQUU7WUFDZixRQUFRLEVBQUUsRUFBRTtZQUNaLE9BQU8sRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUM7WUFDbEIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztZQUNyQixLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDO1NBQ3BCO1FBQ0Q7WUFDSSxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMxRCxXQUFXLEVBQUUsRUFBRTtZQUNmLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDM0MsT0FBTyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQztZQUNsQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO1lBQ3JCLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUM7U0FDcEI7UUFDRDtZQUNJLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzFELFdBQVcsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDN0MsUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDMUQsT0FBTyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQztZQUNsQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO1lBQ3JCLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUM7U0FDcEI7UUFDRDtZQUNJLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUM1RSxXQUFXLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzdDLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMxRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDO1lBQ2xCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7WUFDckIsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQztTQUNwQjtRQUNEO1lBQ0ksUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzFFLFdBQVcsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDN0MsUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDMUQsT0FBTyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQztZQUNsQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO1lBQ3JCLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUM7U0FDcEI7UUFDRDtZQUNJLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDM0YsV0FBVyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUM5QyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDM0UsT0FBTyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQztZQUNsQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO1lBQ3JCLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUM7U0FDcEI7UUFDRDtZQUNJLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDMUYsV0FBVyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUM3QyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMxRCxPQUFPLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDO1lBQ2xCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7WUFDckIsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQztTQUNwQjtRQUNEO1lBQ0ksUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDMUQsV0FBVyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzdFLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDNUMsT0FBTyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQztZQUNsQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO1lBQ3JCLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUM7U0FDcEI7UUFDRDtZQUNJLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMzSCxXQUFXLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzdDLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDN0MsT0FBTyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQztZQUNsQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO1lBQ3JCLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUM7U0FDcEI7UUFDRDtZQUNJLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUM1SCxXQUFXLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzdDLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMzRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDO1lBQ2xCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7WUFDckIsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQztTQUNwQjtRQUNEO1lBQ0ksUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzlLLFdBQVcsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDOUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDNUcsT0FBTyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQztZQUNsQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO1lBQ3JCLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUM7U0FDcEI7UUFDRDtZQUNJLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3pKLFdBQVcsRUFBRSxFQUFFO1lBQ2YsUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUM7WUFDbEIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztZQUNyQixLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDO1NBQ3BCO1FBQ0Q7WUFDSSxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3pJLFdBQVcsRUFBRSxFQUFFO1lBQ2YsUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDNUcsT0FBTyxFQUFFLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQztZQUNsQixRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO1lBQ3JCLEtBQUssRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUM7U0FDcEI7UUFDRDtZQUNJLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUM1SCxXQUFXLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzdDLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzVHLE9BQU8sRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUM7WUFDbEIsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztZQUNyQixLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDO1NBQ3BCO1FBQ0Q7WUFDSSxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzFMLFdBQVcsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDN0MsUUFBUSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMzSSxPQUFPLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDO1lBQ2xCLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7WUFDckIsS0FBSyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQztTQUNwQjtRQUNEO1lBQ0ksUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzdLLFdBQVcsRUFBRSxFQUFFO1lBQ2YsUUFBUSxFQUFFLENBQUMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRSxD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O29CQUN6RCxTQUFTLENBQUMsY0FBYyxFQUFFLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQztnQkFDckQsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDLENBQUM7WUFDRixRQUFRLENBQUMsT0FBTyxHQUFHO2dCQUNmLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDYixrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMxQixDQUFDLENBQUM7WUFFRixXQUFXLENBQUMsT0FBTyxHQUFHO2dCQUNsQixrQkFBa0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNuQyxDQUFDLENBQUM7WUFFRixpRUFBaUU7UUFDckUsQ0FBQyxDQUFDLENBQUM7SUFFUCxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQztBQUVGLFdBQVcsQ0FBQyxZQUFZLEVBQUUsV0FBVyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBjcmVhdGVDYW52YXMgPSAod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpOiBbQ2FudmFzLCBDb250ZXh0XSA9PiB7XG4gICAgY29uc3QgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgY2FudmFzLndpZHRoID0gd2lkdGg7XG4gICAgY2FudmFzLmhlaWdodCA9IGhlaWdodDtcbiAgICBjb25zdCBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoJzJkJykgYXMgQ29udGV4dDtcbiAgICByZXR1cm4gW2NhbnZhcywgY29udGV4dF07XG59O1xuIiwiY29uc3QgY3JlYXRlR2FtZSA9ICgpID0+IHtcblxuICAgIGNvbnN0IGJhY2tncm91bmQgPSBjcmVhdGVHYW1lQmFja2dyb3VuZCgpO1xuXG4gICAgY29uc3QgY3JlYXRlTGV2ZWwgPSAobGV2ZWxEYXRhOiBMZXZlbERhdGEsIHJlc291cmNlczogUmVzb3VyY2VzLCBvbkxldmVsRmluaXNoOiAoKSA9PiB2b2lkKSA9PiB7XG5cbiAgICAgICAgY29uc3QgW2NhbnZhcywgY29udGV4dF0gPSBjcmVhdGVDYW52YXMoMTI4MCwgNzIwKTtcbiAgICAgICAgY29uc3Qgc3BhY2UgPSBjcmVhdGVTcGFjZSgpO1xuXG4gICAgICAgIGxldCBjYW5jZWxGcmFtZUxvb3A6ICgpID0+IHZvaWQ7XG4gICAgICAgIGNvbnN0IGlucHV0Q29udHJvbCA9IGNyZWF0ZUlucHV0Q29udHJvbChjYW52YXMpO1xuICAgICAgICBjb25zdCBzcG9vbFJlbmRlclN5c3RlbSA9IGNyZWF0ZVNwb29sUmVuZGVyU3lzdGVtKHJlc291cmNlcyk7XG4gICAgICAgIGNvbnN0IGNhYmxlUmVuZGVyU3lzdGVtID0gY3JlYXRlQ2FibGVSZW5kZXJTeXN0ZW0oKTtcblxuICAgICAgICBjb25zdCBzaHV0ZG93biA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGNhbmNlbEZyYW1lTG9vcCgpO1xuICAgICAgICAgICAgaW5wdXRDb250cm9sLnNodXRkb3duKCk7XG4gICAgICAgICAgICBzcGFjZS5zaHV0ZG93bigpO1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnZGVmYXVsdCc7XG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IHNwb29sU3lzdGVtID0gY3JlYXRlU3Bvb2xTeXN0ZW0oKCkgPT4ge1xuICAgICAgICAgICAgc2h1dGRvd24oKTtcbiAgICAgICAgICAgIG9uTGV2ZWxGaW5pc2goKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IG1vdXNlRHJhZ1N5c3RlbSA9IGNyZWF0ZU1vdXNlRHJhZ1N5c3RlbShpbnB1dENvbnRyb2wpO1xuXG5cbiAgICAgICAgLy8gdW5jb21tZW50IHRoaXMgbGluZXMgYW5kIHRoZSBsaW5lIGF0IHRoZSBib3R0b20gdG8gZW5hYmxlIGVkaXRvciBtb2RlXG4gICAgICAgIC8vIGNvbnN0IGxldmVsRWRpdG9yU3lzdGVtID0gY3JlYXRlTGV2ZWxFZGl0b3JTeXN0ZW0oc3BhY2UsIGlucHV0Q29udHJvbCk7XG4gICAgICAgIC8vIHNwYWNlLnJlZ2lzdGVyU3lzdGVtKGxldmVsRWRpdG9yU3lzdGVtKTtcblxuXG4gICAgICAgIHNwYWNlLnJlZ2lzdGVyU3lzdGVtKHNwb29sUmVuZGVyU3lzdGVtKTtcbiAgICAgICAgc3BhY2UucmVnaXN0ZXJTeXN0ZW0oc3Bvb2xTeXN0ZW0pO1xuICAgICAgICBzcGFjZS5yZWdpc3RlclN5c3RlbShjYWJsZVJlbmRlclN5c3RlbSk7XG4gICAgICAgIHNwYWNlLnJlZ2lzdGVyU3lzdGVtKG1vdXNlRHJhZ1N5c3RlbSk7XG5cblxuICAgICAgICBsZXZlbERhdGEuc3Bvb2xzLmZvckVhY2goKHNwb29sRGF0YSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc3Bvb2xFbnRpdHk6IFNwb29sTm9kZUVudGl0eSA9IHtcbiAgICAgICAgICAgICAgICBwb3M6IHt4OiBzcG9vbERhdGFbMF0sIHk6IHNwb29sRGF0YVsxXX0sXG4gICAgICAgICAgICAgICAgc3Bvb2w6IHtzaXplOiBzcG9vbERhdGFbMl0sIHR5cGU6IE5vZGVUeXBlLnNwb29sfSxcbiAgICAgICAgICAgICAgICByZW5kZXI6IHt0eXBlOiBOb2RlVHlwZS5zcG9vbH0sXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzcGFjZS5hZGRFbnRpdHkoc3Bvb2xFbnRpdHkpO1xuICAgICAgICB9KTtcblxuICAgICAgICBsZXZlbERhdGEuYmxvY2tzLmZvckVhY2goKGJsb2NrKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBibG9ja0VudGl0eTogQmxvY2tOb2RlRW50aXR5ID0ge1xuICAgICAgICAgICAgICAgIHBvczoge3g6IGJsb2NrWzBdLCB5OiBibG9ja1sxXX0sXG4gICAgICAgICAgICAgICAgYmxvY2s6IHtzaXplOiBibG9ja1syXX0sXG4gICAgICAgICAgICAgICAgcmVuZGVyOiB7dHlwZTogTm9kZVR5cGUuYmxvY2t9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgc3BhY2UuYWRkRW50aXR5KGJsb2NrRW50aXR5KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGV2ZWxEYXRhLmlzb2xhdG9ycy5mb3JFYWNoKChpc29sYXRvcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgYmxvY2tFbnRpdHk6IFNwb29sTm9kZUVudGl0eSA9IHtcbiAgICAgICAgICAgICAgICBwb3M6IHt4OiBpc29sYXRvclswXSwgeTogaXNvbGF0b3JbMV19LFxuICAgICAgICAgICAgICAgIHNwb29sOiB7c2l6ZTogaXNvbGF0b3JbMl0sIHR5cGU6IE5vZGVUeXBlLmlzb2xhdG9yfSxcbiAgICAgICAgICAgICAgICByZW5kZXI6IHt0eXBlOiBOb2RlVHlwZS5pc29sYXRvcn1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBzcGFjZS5hZGRFbnRpdHkoYmxvY2tFbnRpdHkpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBzdGFydDogU3RhcnROb2RlRW50aXR5ID0ge1xuICAgICAgICAgICAgcG9zOiB7eDogbGV2ZWxEYXRhLnN0YXJ0WzBdLCB5OiBsZXZlbERhdGEuc3RhcnRbMV19LFxuICAgICAgICAgICAgc3Bvb2w6IHtzaXplOiAwLCB0eXBlOiBOb2RlVHlwZS5zdGFydH0sXG4gICAgICAgICAgICByZW5kZXI6IHt0eXBlOiBOb2RlVHlwZS5zdGFydH1cbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBlbmQ6IEVuZE5vZGVFbnRpdHkgPSB7XG4gICAgICAgICAgICBwb3M6IHt4OiBsZXZlbERhdGEuZW5kWzBdLCB5OiBsZXZlbERhdGEuZW5kWzFdfSxcbiAgICAgICAgICAgIHNwb29sOiB7c2l6ZTogMCwgdHlwZTogTm9kZVR5cGUuZW5kfSxcbiAgICAgICAgICAgIHJlbmRlcjoge3R5cGU6IE5vZGVUeXBlLmVuZH0sXG4gICAgICAgICAgICBtb3VzZURyYWc6IHtzaXplOiAzMH1cbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBjYWJsZTogQ2FibGVFbnRpdHkgPSB7XG4gICAgICAgICAgICBjYWJsZToge2F0dGFjaG1lbnRzOiBbe2VudGl0eTogc3RhcnQgYXMgU3Bvb2xFbnRpdHksIHNpZGU6IFNpZGUubGVmdH0sIHtlbnRpdHk6IGVuZCBhcyBTcG9vbEVudGl0eSwgc2lkZTogU2lkZS5sZWZ0fV19XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgZmluaXNoOiBGaW5pc2hFbnRpdHkgPSB7XG4gICAgICAgICAgICBmaW5pc2g6IHt9LFxuICAgICAgICAgICAgcmVuZGVyOiB7dHlwZTogTm9kZVR5cGUuZmluaXNofSxcbiAgICAgICAgICAgIHBvczoge3g6IGxldmVsRGF0YS5maW5pc2hbMF0sIHk6IGxldmVsRGF0YS5maW5pc2hbMV19XG4gICAgICAgIH07XG5cbiAgICAgICAgLy9UT0RPOiByZW5kZXIgbGF5ZXJzXG4gICAgICAgIHNwYWNlLmFkZEVudGl0eShzdGFydCk7XG4gICAgICAgIHNwYWNlLmFkZEVudGl0eShmaW5pc2gpO1xuICAgICAgICBzcGFjZS5hZGRFbnRpdHkoZW5kKTtcbiAgICAgICAgc3BhY2UuYWRkRW50aXR5KGNhYmxlKTtcblxuICAgICAgICBjb25zdCB1cGRhdGUgPSAodGltZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBtb3VzZURyYWdTeXN0ZW0udXBkYXRlKHRpbWUpO1xuICAgICAgICAgICAgc3Bvb2xTeXN0ZW0udXBkYXRlKHRpbWUpO1xuICAgICAgICAgICAgLy8gbGV2ZWxFZGl0b3JTeXN0ZW0udXBkYXRlKHRpbWUpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHJlbmRlciA9ICh0aW1lOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIGNvbnRleHQuZHJhd0ltYWdlKGJhY2tncm91bmQsIDAsMCk7XG5cbiAgICAgICAgICAgIGNhYmxlUmVuZGVyU3lzdGVtLnJlbmRlcihjb250ZXh0LCB0aW1lKTtcbiAgICAgICAgICAgIHNwb29sUmVuZGVyU3lzdGVtLnJlbmRlcihjb250ZXh0LCB0aW1lKTtcbiAgICAgICAgfTtcblxuICAgICAgICBjYW5jZWxGcmFtZUxvb3AgPSBzdGFydEZyYW1lTG9vcCh0aW1lID0+IHtcbiAgICAgICAgICAgIHVwZGF0ZSh0aW1lKTtcbiAgICAgICAgICAgIHJlbmRlcih0aW1lKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjYW52YXMsXG4gICAgICAgICAgICBzaHV0ZG93blxuICAgICAgICB9O1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBjcmVhdGVMZXZlbFxuICAgIH07XG59O1xuXG5cblxuIiwiLy8gaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vYmxpeHQvZjE3YjQ3YzYyNTA4YmU1OTk4N2JcbmNvbnN0IGNsYW1wID0gKG51bTogbnVtYmVyLCBtaW46IG51bWJlciwgbWF4OiBudW1iZXIpOiBudW1iZXIgPT4gbnVtIDwgbWluID8gbWluIDogbnVtID4gbWF4ID8gbWF4IDogbnVtO1xuXG4vLyBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9Kb25jb20vZThlOGQxOGViZTdmZTU1YzM4OTRcbmNvbnN0IGxpbmVMaW5lSW50ZXJzZWN0ID0gKGxpbmUxYTogVmVjMiwgbGluZTFiOiBWZWMyLCBsaW5lMmE6IFZlYzIsIGxpbmUyYjogVmVjMik6IGJvb2xlYW4gPT4ge1xuICAgIC8vIHZhciBzMV94LCBzMV95LCBzMl94LCBzMl95O1xuICAgIGNvbnN0IHMxX3ggPSBsaW5lMWIueCAtIGxpbmUxYS54O1xuICAgIGNvbnN0IHMxX3kgPSBsaW5lMWIueSAtIGxpbmUxYS55O1xuICAgIGNvbnN0IHMyX3ggPSBsaW5lMmIueCAtIGxpbmUyYS54O1xuICAgIGNvbnN0IHMyX3kgPSBsaW5lMmIueSAtIGxpbmUyYS55O1xuXG4gICAgLy8gdmFyIHMsIHQ7XG4gICAgY29uc3QgcyA9ICgtczFfeSAqIChsaW5lMWEueCAtIGxpbmUyYS54KSArIHMxX3ggKiAobGluZTFhLnkgLSBsaW5lMmEueSkpIC8gKC1zMl94ICogczFfeSArIHMxX3ggKiBzMl95KTtcbiAgICBjb25zdCB0ID0gKHMyX3ggKiAobGluZTFhLnkgLSBsaW5lMmEueSkgLSBzMl95ICogKGxpbmUxYS54IC0gbGluZTJhLngpKSAvICgtczJfeCAqIHMxX3kgKyBzMV94ICogczJfeSk7XG5cbiAgICByZXR1cm4gcyA+PSAwICYmIHMgPD0gMSAmJiB0ID49IDAgJiYgdCA8PSAxO1xufTtcblxuLy8gYm9ycm93ZWQgZnJvbSBodHRwczovL2NvZGVyZXZpZXcuc3RhY2tleGNoYW5nZS5jb20vcXVlc3Rpb25zLzE5MjQ3Ny9jaXJjbGUtbGluZS1zZWdtZW50LWNvbGxpc2lvblxuY29uc3QgbGluZUNpcmNsZUludGVyc2VjdCA9IChsaW5lQTogVmVjMiwgbGluZUI6IFZlYzIsIGNpcmNsZTogVmVjMiwgcmFkaXVzOiBudW1iZXIpOiBib29sZWFuID0+IHtcbiAgICBsZXQgZGlzdDtcbiAgICBjb25zdCB2MXggPSBsaW5lQi54IC0gbGluZUEueDtcbiAgICBjb25zdCB2MXkgPSBsaW5lQi55IC0gbGluZUEueTtcbiAgICBjb25zdCB2MnggPSBjaXJjbGUueCAtIGxpbmVBLng7XG4gICAgY29uc3QgdjJ5ID0gY2lyY2xlLnkgLSBsaW5lQS55O1xuICAgIC8vIGdldCB0aGUgdW5pdCBkaXN0YW5jZSBhbG9uZyB0aGUgbGluZSBvZiB0aGUgY2xvc2VzdCBwb2ludCB0b1xuICAgIC8vIGNpcmNsZSBjZW50ZXJcbiAgICBjb25zdCB1ID0gKHYyeCAqIHYxeCArIHYyeSAqIHYxeSkgLyAodjF5ICogdjF5ICsgdjF4ICogdjF4KTtcblxuICAgIC8vIGlmIHRoZSBwb2ludCBpcyBvbiB0aGUgbGluZSBzZWdtZW50IGdldCB0aGUgZGlzdGFuY2Ugc3F1YXJlZFxuICAgIC8vIGZyb20gdGhhdCBwb2ludCB0byB0aGUgY2lyY2xlIGNlbnRlclxuICAgIGlmICh1ID49IDAgJiYgdSA8PSAxKSB7XG4gICAgICAgIGRpc3QgPSAobGluZUEueCArIHYxeCAqIHUgLSBjaXJjbGUueCkgKiogMiArIChsaW5lQS55ICsgdjF5ICogdSAtIGNpcmNsZS55KSAqKiAyO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGlmIGNsb3Nlc3QgcG9pbnQgbm90IG9uIHRoZSBsaW5lIHNlZ21lbnRcbiAgICAgICAgLy8gdXNlIHRoZSB1bml0IGRpc3RhbmNlIHRvIGRldGVybWluZSB3aGljaCBlbmQgaXMgY2xvc2VzdFxuICAgICAgICAvLyBhbmQgZ2V0IGRpc3Qgc3F1YXJlIHRvIGNpcmNsZVxuICAgICAgICBkaXN0ID0gdSA8IDAgP1xuICAgICAgICAgICAgKGxpbmVBLnggLSBjaXJjbGUueCkgKiogMiArIChsaW5lQS55IC0gY2lyY2xlLnkpICoqIDIgOlxuICAgICAgICAgICAgKGxpbmVCLnggLSBjaXJjbGUueCkgKiogMiArIChsaW5lQi55IC0gY2lyY2xlLnkpICoqIDI7XG4gICAgfVxuICAgIHJldHVybiBkaXN0IDwgcmFkaXVzICogcmFkaXVzO1xufTtcblxuLy8gaHR0cHM6Ly9qc2ZpZGRsZS5uZXQvTWFkTGl0dGxlTW9kcy8wZWgwemV5dS9cbmNvbnN0IGRpc3QyID0gKHB0MTogVmVjMiwgcHQyOiBWZWMyKSA9PiBNYXRoLnBvdyhwdDEueCAtIHB0Mi54LCAyKSArIE1hdGgucG93KHB0MS55IC0gcHQyLnksIDIpO1xuXG4vLyBodHRwczovL2VuLndpa2lib29rcy5vcmcvd2lraS9BbGdvcml0aG1fSW1wbGVtZW50YXRpb24vR2VvbWV0cnkvVGFuZ2VudHNfYmV0d2Vlbl90d29fY2lyY2xlc1xuY29uc3QgZ2V0VGFuZ2VudHMgPSAocDE6IFZlYzIsIHIxOiBudW1iZXIsIHAyOiBWZWMyLCByMjogbnVtYmVyKTogVmVjMltdW10gPT4ge1xuICAgIGxldCBkX3NxID0gKHAxLnggLSBwMi54KSAqIChwMS54IC0gcDIueCkgKyAocDEueSAtIHAyLnkpICogKHAxLnkgLSBwMi55KTtcblxuICAgIGlmIChkX3NxIDw9IChyMSAtIHIyKSAqIChyMSAtIHIyKSkgcmV0dXJuIFtdO1xuXG4gICAgbGV0IGQgPSBNYXRoLnNxcnQoZF9zcSk7XG4gICAgbGV0IHZ4ID0gKHAyLnggLSBwMS54KSAvIGQ7XG4gICAgbGV0IHZ5ID0gKHAyLnkgLSBwMS55KSAvIGQ7XG5cbiAgICAvLyBkb3VibGVbXVtdIHJlcyA9IG5ldyBkb3VibGVbNF1bNF07XG4gICAgbGV0IHJlc3VsdCA9IFtdO1xuICAgIGxldCBpID0gMDtcblxuICAgIC8vIExldCBBLCBCIGJlIHRoZSBjZW50ZXJzLCBhbmQgQywgRCBiZSBwb2ludHMgYXQgd2hpY2ggdGhlIHRhbmdlbnRcbiAgICAvLyB0b3VjaGVzIGZpcnN0IGFuZCBzZWNvbmQgY2lyY2xlLCBhbmQgbiBiZSB0aGUgbm9ybWFsIHZlY3RvciB0byBpdC5cbiAgICAvL1xuICAgIC8vIFdlIGhhdmUgdGhlIHN5c3RlbTpcbiAgICAvLyAgIG4gKiBuID0gMSAgICAgICAgICAobiBpcyBhIHVuaXQgdmVjdG9yKVxuICAgIC8vICAgQyA9IEEgKyByMSAqIG5cbiAgICAvLyAgIEQgPSBCICsvLSByMiAqIG5cbiAgICAvLyAgIG4gKiBDRCA9IDAgICAgICAgICAoY29tbW9uIG9ydGhvZ29uYWxpdHkpXG4gICAgLy9cbiAgICAvLyBuICogQ0QgPSBuICogKEFCICsvLSByMipuIC0gcjEqbikgPSBBQipuIC0gKHIxIC0vKyByMikgPSAwLCAgPD0+XG4gICAgLy8gQUIgKiBuID0gKHIxIC0vKyByMiksIDw9PlxuICAgIC8vIHYgKiBuID0gKHIxIC0vKyByMikgLyBkLCAgd2hlcmUgdiA9IEFCL3xBQnwgPSBBQi9kXG4gICAgLy8gVGhpcyBpcyBhIGxpbmVhciBlcXVhdGlvbiBpbiB1bmtub3duIHZlY3RvciBuLlxuXG4gICAgZm9yIChsZXQgc2lnbjEgPSArMTsgc2lnbjEgPj0gLTE7IHNpZ24xIC09IDIpIHtcbiAgICAgICAgbGV0IGMgPSAocjEgLSBzaWduMSAqIHIyKSAvIGQ7XG5cbiAgICAgICAgLy8gTm93IHdlJ3JlIGp1c3QgaW50ZXJzZWN0aW5nIGEgbGluZSB3aXRoIGEgY2lyY2xlOiB2Km49YywgbipuPTFcblxuICAgICAgICBpZiAoYyAqIGMgPiAxLjApIGNvbnRpbnVlO1xuICAgICAgICBsZXQgaCA9IE1hdGguc3FydChNYXRoLm1heCgwLjAsIDEuMCAtIGMgKiBjKSk7XG5cbiAgICAgICAgZm9yIChsZXQgc2lnbjIgPSArMTsgc2lnbjIgPj0gLTE7IHNpZ24yIC09IDIpIHtcbiAgICAgICAgICAgIGxldCBueCA9IHZ4ICogYyAtIHNpZ24yICogaCAqIHZ5O1xuICAgICAgICAgICAgbGV0IG55ID0gdnkgKiBjICsgc2lnbjIgKiBoICogdng7XG4gICAgICAgICAgICByZXN1bHRbaV0gPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IGEgPSByZXN1bHRbaV0gPSBuZXcgQXJyYXkoMik7XG4gICAgICAgICAgICBhWzBdID0ge3g6IHAxLnggKyByMSAqIG54LCB5OiBwMS55ICsgcjEgKiBueX07XG4gICAgICAgICAgICBhWzFdID0ge3g6IHAyLnggKyBzaWduMSAqIHIyICogbngsIHk6IHAyLnkgKyBzaWduMSAqIHIyICogbnl9O1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cblxuY29uc3Qgc2lkZU9mTGluZSA9IChwMTogVmVjMiwgcDI6IFZlYzIsIHA6IFZlYzIpOiBTaWRlID0+ICgocDIueCAtIHAxLngpICogKHAueSAtIHAxLnkpIC0gKHAyLnkgLSBwMS55KSAqIChwLnggLSBwMS54KSkgPiAwID8gU2lkZS5sZWZ0IDogU2lkZS5yaWdodDtcblxuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIm1hdGgtdXRpbC50c1wiIC8+XG5jb25zdCBmcmFjdCA9IChuOm51bWJlcikgPT4gICgobiAlIDEpICsgMSkgJSAxO1xuXG5jb25zdCBzdWJWID0gKHYxOiBWZWMyLCB2MjogVmVjMik6IFZlYzIgPT4gKHt4OiB2MS54IC0gdjIueCwgeTogdjEueSAtIHYyLnl9KTtcbmNvbnN0IGFkZFYgPSAodjE6IFZlYzIsIHYyOiBWZWMyKTogVmVjMiA9PiAoe3g6IHYxLnggKyB2Mi54LCB5OiB2MS55ICsgdjIueX0pO1xuY29uc3QgbXVsVlMgPSAodjogVmVjMiwgczogbnVtYmVyKTogVmVjMiA9PiAoe3g6IHYueCAqIHMsIHk6IHYueSAqIHN9KTtcbmNvbnN0IGRpdlZTID0gKHY6IFZlYzIsIHM6IG51bWJlcik6IFZlYzIgPT4gbXVsVlModiwgMSAvIHMpO1xuY29uc3QgbGVuViA9ICh2OiBWZWMyKTogbnVtYmVyID0+IE1hdGguc3FydCh2LnggKiB2LnggKyB2LnkgKiB2LnkpO1xuY29uc3QgZGlzdFYgPSAodjE6IFZlYzIsIHYyOiBWZWMyKTogbnVtYmVyID0+IGxlblYoc3ViVih2MSwgdjIpKTtcbmNvbnN0IG5vcm1hbGl6ZVYgPSAodjogVmVjMik6IFZlYzIgPT4gZGl2VlModiwgbGVuVih2KSB8fCAxKTtcbmNvbnN0IHBlcnBMZWZ0ViA9ICh2OiBWZWMyKSA9PiAoe3g6IC12LnksIHk6IHYueH0pO1xuY29uc3QgcGVycFJpZ2h0ViA9ICh2OiBWZWMyKSA9PiAoe3g6IHYueSwgeTogLXYueH0pO1xuY29uc3QgYW5nbGVWID0gKHY6IFZlYzIpOiBudW1iZXIgPT4ge1xuICAgIGxldCBhbmdsZSA9IE1hdGguYXRhbjIodi55LCB2LngpO1xuICAgIGlmIChhbmdsZSA8IDApIGFuZ2xlICs9IDIgKiBNYXRoLlBJO1xuICAgIHJldHVybiBhbmdsZTtcbn07XG5jb25zdCBjb3B5SW50b1YgPSAodGFyZ2V0OiBWZWMyLCBzb3VyY2U6IFZlYzIpOiB2b2lkID0+IHtcbiAgICB0YXJnZXQueCA9IHNvdXJjZS54O1xuICAgIHRhcmdldC55ID0gc291cmNlLnk7XG59O1xuY29uc3QgY29weVYgPSAoc291cmNlOiBWZWMyKTogVmVjMiA9PiAoe3g6c291cmNlLngsIHk6IHNvdXJjZS55fSk7XG5jb25zdCBmcmFjdFYgPSAodjogVmVjMikgPT4gKHt4OiBmcmFjdCh2LngpLCB5OiBmcmFjdCh2LnkpfSk7XG5jb25zdCBmbG9vclYgPSAodjogVmVjMikgPT4gKHt4OiB+fnYueCwgeTogfn52Lnl9KTtcbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJjYW52YXMudHNcIiAvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cInZlY3Rvci50c1wiIC8+XG5cbmNvbnN0IG1peCA9IChhOiBudW1iZXIsIGI6IG51bWJlciwgbTogbnVtYmVyKSA9PiAoMSAtIG0pICogYSArIG0gKiBiO1xuY29uc3QgbWl4Q29sID0gKGE6IENvbG9yLCBiOiBDb2xvciwgbTogbnVtYmVyKTogQ29sb3IgPT4gKHtcbiAgICByOiBtaXgoYS5yLCBiLnIsIG0pLFxuICAgIGc6IG1peChhLmcsIGIuZywgbSksXG4gICAgYjogbWl4KGEuYiwgYi5iLCBtKSxcbiAgICBhOiBtaXgoYS5hLCBiLmEsIG0pLFxufSk7XG5cbmNvbnN0IGhhbGZWID0ge3g6IDAuNSwgeTogMC41fTtcbmNvbnN0IHYxMCA9IHt4OiAxLCB5OiAwfTtcbmNvbnN0IHYwMSA9IHt4OiAwLCB5OiAxfTtcbmNvbnN0IHYxMSA9IHt4OiAxLCB5OiAxfTtcbmNvbnN0IG4yMSA9ICh2OiBWZWMyKTogbnVtYmVyID0+ICgoTWF0aC5zaW4odi54ICogMTAwICsgdi55ICogNjU3NCkgKyAxKSAqIDU2NCkgJSAxO1xuXG5jb25zdCBub2lzZSA9ICh2OiBWZWMyKTogbnVtYmVyID0+IHtcbiAgICBjb25zdCBsdiA9IGZyYWN0Vih2KTtcbiAgICBjb25zdCBpZCA9IGZsb29yVih2KTtcbiAgICBjb25zdCBibCA9IG4yMShpZCk7XG4gICAgY29uc3QgYnIgPSBuMjEoYWRkVihpZCwgdjEwKSk7XG4gICAgY29uc3QgYiA9IG1peChibCwgYnIsIGx2LngpO1xuXG4gICAgY29uc3QgdGwgPSBuMjEoYWRkVihpZCwgdjAxKSk7XG4gICAgY29uc3QgdHIgPSBuMjEoYWRkVihpZCwgdjExKSk7XG5cbiAgICBjb25zdCB0ID0gbWl4KHRsLCB0ciwgbHYueCk7XG5cbiAgICByZXR1cm4gbWl4KGIsIHQsIGx2LnkpO1xufTtcbmNvbnN0IHNtb290aHN0ZXAgPSAobWluOiBudW1iZXIsIG1heDogbnVtYmVyLCB2YWx1ZTogbnVtYmVyKSA9PiB7XG4gICAgY29uc3QgeCA9IGNsYW1wKCh2YWx1ZSAtIG1pbikgLyAobWF4IC0gbWluKSwgMCwgMSk7XG4gICAgcmV0dXJuIHggKiB4ICogKDMgLSAyICogeCk7XG59O1xuY29uc3QgbmV3Q29sID0gKHI6IG51bWJlciA9IDEsIGc6IG51bWJlciA9IDEsIGI6IG51bWJlciA9IDEsIGE6IG51bWJlciA9IDEpOiBDb2xvciA9PiAoe3IsIGcsIGIsIGF9KTtcbmNvbnN0IG11bENvbCA9IChjb2xvcjogQ29sb3IsIHY6IG51bWJlcikgPT4gKHtcbiAgICByOiBjb2xvci5yICogdixcbiAgICBnOiBjb2xvci5nICogdixcbiAgICBiOiBjb2xvci5iICogdixcbiAgICBhOiBjb2xvci5hXG59KTtcblxuY29uc3QgYWRkQ29sID0gKGE6IENvbG9yLCBiOiBDb2xvcikgPT4ge1xuICAgIHJldHVybiB7XG4gICAgICAgIHI6IGEuciArIGIuciAqIGIuYSxcbiAgICAgICAgZzogYS5nICsgYi5nICogYi5hLFxuICAgICAgICBiOiBhLmIgKyBiLmIgKiBiLmEsXG4gICAgICAgIGE6IGEuYSArIGIuYVxuICAgIH07XG59O1xuY29uc3QgZ2VuZXJhdGVJbWFnZSA9ICh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgY2I6ICh2OiBWZWMyKSA9PiBDb2xvcikgPT4ge1xuICAgIGNvbnN0IFtjYW52YXMsIGNvbnRleHRdID0gY3JlYXRlQ2FudmFzKHdpZHRoLCBoZWlnaHQpO1xuICAgIGNvbnN0IGltYWdlRGF0YSA9IGNvbnRleHQuZ2V0SW1hZ2VEYXRhKDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuICAgIGNvbnN0IGJ1ZiA9IG5ldyBBcnJheUJ1ZmZlcihpbWFnZURhdGEuZGF0YS5sZW5ndGgpO1xuICAgIGNvbnN0IGJ1ZjggPSBuZXcgVWludDhDbGFtcGVkQXJyYXkoYnVmKTtcbiAgICBjb25zdCBkYXRhMzIgPSBuZXcgVWludDMyQXJyYXkoYnVmKTtcbiAgICBjb25zdCB2OiBQYXJ0aWFsPFZlYzI+ID0ge307XG5cbiAgICBmb3IgKGxldCB5ID0gMDsgeSA8IGhlaWdodDsgeSsrKSB7XG4gICAgICAgIGZvciAobGV0IHggPSAwOyB4IDwgd2lkdGg7IHgrKykge1xuICAgICAgICAgICAgdi54ID0geCAvICh3aWR0aCAtIDEpO1xuICAgICAgICAgICAgdi55ID0geSAvIChoZWlnaHQgLSAxKTtcbiAgICAgICAgICAgIGNvbnN0IGMgPSBjYih2IGFzIFZlYzIpO1xuICAgICAgICAgICAgZGF0YTMyW3kgKiB3aWR0aCArIHhdID1cbiAgICAgICAgICAgICAgICAoY2xhbXAoYy5hISAqIDI1NSwgMCwgMjU1KSA8PCAyNCkgfCAgICAvLyBhbHBoYVxuICAgICAgICAgICAgICAgIChjbGFtcChjLmIhICogMjU1LCAwLCAyNTUpIDw8IDE2KSB8ICAgIC8vIGJsdWVcbiAgICAgICAgICAgICAgICAoY2xhbXAoYy5nISAqIDI1NSwgMCwgMjU1KSA8PCA4KSB8ICAgIC8vIGdyZWVuXG4gICAgICAgICAgICAgICAgY2xhbXAoYy5yISAqIDI1NSwgMCwgMjU1KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpbWFnZURhdGEuZGF0YS5zZXQoYnVmOCk7XG4gICAgY29udGV4dC5wdXRJbWFnZURhdGEoaW1hZ2VEYXRhLCAwLCAwKTtcblxuICAgIHJldHVybiBjYW52YXM7XG59O1xuXG4vLyBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9zYWtyaXN0Lzg3MDY3NDlcbmNvbnN0IGNyZWF0ZUhleEZpZWxkID0gKHY6IFZlYzIsIHNjYWxlOiBudW1iZXIpOiBudW1iZXIgPT4ge1xuICAgIGxldCB7eCwgeX0gPSBtdWxWUyh2LCBzY2FsZSk7XG4gICAgeCAqPSAwLjU3NzM1ICogMi4wO1xuICAgIHkgKz0gKE1hdGguZmxvb3IoeCkgJSAyKSAqIDAuNTtcbiAgICB4ID0gTWF0aC5hYnMoeCAlIDEgLSAwLjUpO1xuICAgIHkgPSBNYXRoLmFicyh5ICUgMSAtIDAuNSk7XG4gICAgcmV0dXJuIE1hdGguYWJzKE1hdGgubWF4KHggKiAxLjUgKyB5LCB5ICogMi4wKSAtIDEuMCk7XG59O1xuXG5jb25zdCBjcmVhdGVNZXRhbFBsYXRlID0gKGE6IG51bWJlciwgZDogbnVtYmVyKTogbnVtYmVyID0+IHtcbiAgICBjb25zdCBzaGFkaW5nID0gc21vb3Roc3RlcCgwLjkxLCAwLjk0LCBkKSAtIHNtb290aHN0ZXAoMC40MSwgMC40MiwgZCk7XG4gICAgYSArPSBzaGFkaW5nO1xuICAgIHJldHVybiAwLjkgKyAwLjEgKiBNYXRoLnNpbihhICogNikgKiAwLjkgKyAwLjEgKiBNYXRoLnNpbihhICogNClcbiAgICAgICAgLSAobm9pc2Uoe3g6IChhICsgNCArIGQgKiA1KSAqIDIsIHk6IGQgKiA4MH0pICogMC4xKSArIHNoYWRpbmcgKiAwLjI7XG59O1xuXG5jb25zdCBjcmVhdGVDb2lsU3ByaXRlID0gKHNpemU6IG51bWJlcik6IENhbnZhcyA9PiB7XG4gICAgY29uc3Qgc3cgPSA0IC8gc2l6ZTtcbiAgICBjb25zdCBoZXhGaWVsZFNjYWxlID0gc2l6ZSAvIDQ7XG4gICAgY29uc3QgaGV4RmllbGRCcmlnaHRuZXNzID0gMC43O1xuICAgIGNvbnN0IHJpbmdCcmlnaHRuZXNzID0gMC40O1xuICAgIGNvbnN0IGdyaWRTaGFkb3dCbHVyID0gMC4xO1xuICAgIGNvbnN0IGdyaWRTaGFkb3dTdHJlbmd0aCA9IDE7XG4gICAgY29uc3QgcmluZ1dpZHRoID0gMC4yO1xuICAgIGNvbnN0IGJ1dHRvblNpemUgPSAwLjU7XG4gICAgY29uc3QgZ3JpZENvbG9yID0gbmV3Q29sKDAuNjE1LCAwLjcwNSwgMSwgMSk7XG4gICAgY29uc3QgbWV0YWxDb2xvciA9IG5ld0NvbCgxLCAxLCAxLCAxKTtcbiAgICBjb25zdCBzaGFkb3dCbHVyID0gMC4yO1xuICAgIGNvbnN0IHNoYWRvd0Rpc3RhbmNlID0gMC4wNDtcbiAgICBjb25zdCBzaGFkb3dTY2FsZSA9IDEuMTtcbiAgICBjb25zdCBzaGFkb3dTdHJlbmd0aCA9IDAuNTtcblxuICAgIGNvbnN0IGltYWdlID0gZ2VuZXJhdGVJbWFnZShNYXRoLnJvdW5kKHNpemUgKiAxLjEpLCBNYXRoLnJvdW5kKHNpemUgKiAxLjEpLCB2ID0+IHtcbiAgICAgICAgdiA9IG11bFZTKHYsIDEuMSk7IC8vIHNjYWxlIHRvIG1ha2Ugcm9vbSBmb3Igc2hhZG93XG4gICAgICAgIGNvbnN0IGNlbnRlclYgPSBzdWJWKHYsIGhhbGZWKTtcbiAgICAgICAgY29uc3QgYSA9IE1hdGguYXRhbjIoY2VudGVyVi55LCBjZW50ZXJWLngpO1xuICAgICAgICBjb25zdCBkID0gbGVuVihjZW50ZXJWKSAqIDI7XG4gICAgICAgIGxldCBncmlkID0gaGV4RmllbGRCcmlnaHRuZXNzICogc21vb3Roc3RlcCgwLjMsIDEsIDEgLSBjcmVhdGVIZXhGaWVsZCh2LCBoZXhGaWVsZFNjYWxlKSk7IC8vIFRPRE86IEZPUiBTUE9PTFxuICAgICAgICBjb25zdCBncmlkU2hhZG93ID0gMSAtIChzbW9vdGhzdGVwKDEgLSByaW5nV2lkdGggKiAwLjY1LCAxIC0gcmluZ1dpZHRoIC0gZ3JpZFNoYWRvd0JsdXIsIGQpIC1cbiAgICAgICAgICAgIHNtb290aHN0ZXAoYnV0dG9uU2l6ZSArIGdyaWRTaGFkb3dCbHVyLCBidXR0b25TaXplICogMC44NSwgZCkpO1xuICAgICAgICBncmlkIC09IChncmlkU2hhZG93ICogZ3JpZFNoYWRvd1N0cmVuZ3RoKTtcblxuICAgICAgICBjb25zdCBtZXRhbFBsYXRlID0gY3JlYXRlTWV0YWxQbGF0ZShhLCBkKSAqIHJpbmdCcmlnaHRuZXNzO1xuICAgICAgICBjb25zdCByaW5nTWFzayA9IHNtb290aHN0ZXAoMSAtIHJpbmdXaWR0aCwgMSAtIHJpbmdXaWR0aCArIHN3LCBkKSArIHNtb290aHN0ZXAoYnV0dG9uU2l6ZSwgYnV0dG9uU2l6ZSAtIHN3LCBkKTtcbiAgICAgICAgY29uc3Qgc3ByaXRlQ29sID0gbWl4Q29sKG11bENvbChncmlkQ29sb3IsIGdyaWQpLCBtdWxDb2wobWV0YWxDb2xvciwgbWV0YWxQbGF0ZSksIHJpbmdNYXNrKTtcblxuICAgICAgICBjb25zdCBzaGFkb3cgPSBzbW9vdGhzdGVwKDEsIDEgLSBzaGFkb3dCbHVyLCBsZW5WKHN1YlYoY2VudGVyViwge1xuICAgICAgICAgICAgeDogc2hhZG93RGlzdGFuY2UsXG4gICAgICAgICAgICB5OiBzaGFkb3dEaXN0YW5jZVxuICAgICAgICB9KSkgKiAyIC8gc2hhZG93U2NhbGUpICogc2hhZG93U3RyZW5ndGg7XG4gICAgICAgIGNvbnN0IHNoYWRvd0NvbCA9IG5ld0NvbCgwLCAwLCAwLCBzaGFkb3cpO1xuXG4gICAgICAgIHJldHVybiBtaXhDb2woc3ByaXRlQ29sLCBzaGFkb3dDb2wsIHNtb290aHN0ZXAoMSAtIHN3LCAxLCBkKSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gaW1hZ2U7XG5cbn07XG5cbmNvbnN0IGNyZWF0ZUlzb2xhdG9yU3ByaXRlID0gKHNpemU6IG51bWJlcik6IENhbnZhcyA9PiB7XG4gICAgY29uc3Qgc3cgPSA0IC8gc2l6ZTtcbiAgICBjb25zdCBoZXhGaWVsZFNjYWxlID0gc2l6ZSAvIDg7XG4gICAgY29uc3QgaGV4RmllbGRCcmlnaHRuZXNzID0gMC43O1xuICAgIGNvbnN0IHJpbmdCcmlnaHRuZXNzID0gMC40O1xuICAgIGNvbnN0IGdyaWRTaGFkb3dCbHVyID0gMC4yO1xuICAgIGNvbnN0IGdyaWRTaGFkb3dTdHJlbmd0aCA9IDAuNjtcbiAgICBjb25zdCByaW5nV2lkdGggPSAwLjE1O1xuICAgIGNvbnN0IGJ1dHRvblNpemUgPSAwLjM7XG4gICAgY29uc3QgZ3JpZENvbG9yID0gbmV3Q29sKDAuODE1LCAwLjI3MDUsIC4yLCAxKTsgLy8gaXNvbGF0ZSByZWRcbiAgICBjb25zdCBtZXRhbENvbG9yID0gbmV3Q29sKDEsIDEsIDEsIDEpO1xuICAgIGNvbnN0IHNoYWRvd0JsdXIgPSAwLjI7XG4gICAgY29uc3Qgc2hhZG93RGlzdGFuY2UgPSAwLjA0O1xuICAgIGNvbnN0IHNoYWRvd1NjYWxlID0gMS4xO1xuICAgIGNvbnN0IHNoYWRvd1N0cmVuZ3RoID0gMC41O1xuXG4gICAgY29uc3QgaW1hZ2UgPSBnZW5lcmF0ZUltYWdlKE1hdGgucm91bmQoc2l6ZSAqIDEuMSksIE1hdGgucm91bmQoc2l6ZSAqIDEuMSksIHYgPT4ge1xuICAgICAgICB2ID0gbXVsVlModiwgMS4xKTsgLy8gc2NhbGUgdG8gbWFrZSByb29tIGZvciBzaGFkb3dcbiAgICAgICAgY29uc3QgY2VudGVyViA9IHN1YlYodiwgaGFsZlYpO1xuICAgICAgICBjb25zdCBhID0gTWF0aC5hdGFuMihjZW50ZXJWLnksIGNlbnRlclYueCk7IC8vIHBvbGFyIHhcbiAgICAgICAgY29uc3QgZCA9IGxlblYoY2VudGVyVikgKiAyOyAgICAgICAgICAgICAgICAvLyBwb2xhciB5XG4gICAgICAgIGxldCBncmlkID0gaGV4RmllbGRCcmlnaHRuZXNzICogc21vb3Roc3RlcCgwLjAyLCAwLjQxLCAxIC0gY3JlYXRlSGV4RmllbGQodiwgaGV4RmllbGRTY2FsZSkpOyAvLyBUT0RPIEZPUiBJU09MQVRPUlxuICAgICAgICBjb25zdCBncmlkU2hhZG93ID0gMSAtIChzbW9vdGhzdGVwKDEgLSByaW5nV2lkdGggKiAwLjY1LCAxIC0gcmluZ1dpZHRoIC0gZ3JpZFNoYWRvd0JsdXIsIGQpIC1cbiAgICAgICAgICAgIHNtb290aHN0ZXAoYnV0dG9uU2l6ZSArIGdyaWRTaGFkb3dCbHVyLCBidXR0b25TaXplICogMC44NSwgZCkpO1xuICAgICAgICBncmlkIC09IChncmlkU2hhZG93ICogZ3JpZFNoYWRvd1N0cmVuZ3RoKTtcblxuICAgICAgICBjb25zdCBtZXRhbFBsYXRlID0gY3JlYXRlTWV0YWxQbGF0ZShhLCBkKSAqIHJpbmdCcmlnaHRuZXNzO1xuICAgICAgICBjb25zdCByaW5nTWFzayA9IHNtb290aHN0ZXAoMSAtIHJpbmdXaWR0aCwgMSAtIHJpbmdXaWR0aCArIHN3LCBkKSArIHNtb290aHN0ZXAoYnV0dG9uU2l6ZSwgYnV0dG9uU2l6ZSAtIHN3LCBkKTtcbiAgICAgICAgY29uc3Qgc3ByaXRlQ29sID0gbWl4Q29sKG11bENvbChncmlkQ29sb3IsIGdyaWQpLCBtdWxDb2wobWV0YWxDb2xvciwgbWV0YWxQbGF0ZSksIHJpbmdNYXNrKTtcblxuICAgICAgICBjb25zdCBzaGFkb3cgPSBzbW9vdGhzdGVwKDEsIDEgLSBzaGFkb3dCbHVyLCBsZW5WKHN1YlYoY2VudGVyViwge1xuICAgICAgICAgICAgeDogc2hhZG93RGlzdGFuY2UsXG4gICAgICAgICAgICB5OiBzaGFkb3dEaXN0YW5jZVxuICAgICAgICB9KSkgKiAyIC8gc2hhZG93U2NhbGUpICogc2hhZG93U3RyZW5ndGg7XG4gICAgICAgIGNvbnN0IHNoYWRvd0NvbCA9IG5ld0NvbCgwLCAwLCAwLCBzaGFkb3cpO1xuXG4gICAgICAgIHJldHVybiBtaXhDb2woc3ByaXRlQ29sLCBzaGFkb3dDb2wsIHNtb290aHN0ZXAoMSAtIHN3LCAxLCBkKSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gaW1hZ2U7XG5cbn07XG5cbmNvbnN0IGNyZWF0ZUdlYXIgPSAocHg6bnVtYmVyLCBweTpudW1iZXIsIG91dGVyU2l6ZTogbnVtYmVyLCBpbm5lclNpemU6bnVtYmVyLCBzdGVwOiBudW1iZXIpOiBudW1iZXIgPT4ge1xuICAgIGNvbnN0IHMgPSBNYXRoLm1pbihmcmFjdChweCksIGZyYWN0KDEgLSBweCkpICogMjtcbiAgICBjb25zdCBzcGlrZXMgPSBzbW9vdGhzdGVwKDAsIHN0ZXAqOCwgcyAtIHB5KTtcbiAgICBjb25zdCBjZW50ZXIgPSBzbW9vdGhzdGVwKGlubmVyU2l6ZSwgaW5uZXJTaXplK3N0ZXAsIDEgLSBweSk7XG4gICAgY29uc3QgY3V0ID0gc21vb3Roc3RlcChvdXRlclNpemUrc3RlcCxvdXRlclNpemUgLCAxIC0gcHkpO1xuICAgIHJldHVybiBjbGFtcChzcGlrZXMgK2NlbnRlciAtIGN1dCwgMCwxKTtcbn07XG5cbmNvbnN0IGNyZWF0ZUJsb2NrU3ByaXRlID0gKHNpemU6IG51bWJlcik6IENhbnZhcyA9PiB7XG4gICAgY29uc3QgaW1hZ2UgPSBnZW5lcmF0ZUltYWdlKHNpemUsIHNpemUsIHYgPT4ge1xuICAgICAgICBjb25zdCBjdiA9IHN1YlYodiwgaGFsZlYpO1xuICAgICAgICBjb25zdCBkID0gbGVuVihjdikgKiAyO1xuICAgICAgICBjb25zdCBhdGFuID0gTWF0aC5hdGFuMihjdi55LCBjdi54KTtcbiAgICAgICAgY29uc3QgcHggPSBhdGFuIC8gKE1hdGguUEkgKiAyKSArIDAuNTsgICAgLy8gcG9sYXIgdHdpc3RlZE14XG4gICAgICAgIGNvbnN0IHR3aXN0ZWRQeCA9IGF0YW4gLyAoTWF0aC5QSSAqIDIpICsgMC41ICsgZCAqIDAuMzsgICAgLy8gcG9sYXIgdHdpc3RlZE14XG4gICAgICAgIGNvbnN0IHR3aXN0ZWRNeCA9IHR3aXN0ZWRQeCAqIE1hdGgucm91bmQoOCtzaXplLzUwKTtcbiAgICAgICAgY29uc3QgbXggPSBweCAqIE1hdGgucm91bmQoNStzaXplLzIwMCk7XG4gICAgICAgIGNvbnN0IG0gPSBNYXRoLm1pbihmcmFjdCh0d2lzdGVkTXgpLCBmcmFjdCgxIC0gdHdpc3RlZE14KSk7XG4gICAgICAgIGxldCBibGFkZUFscGhhID0gc21vb3Roc3RlcCgwLjAsIDAuMDgsIG0gKiAwLjUgLSBkICsgMC43KTtcbiAgICAgICAgbGV0IHNoYWRvdyA9IDEtc21vb3Roc3RlcCgwLjksIDAuMiwgZCk7XG4gICAgICAgIGxldCBibGFkZSA9IDEuNCAqIGQgLSBibGFkZUFscGhhICogMC41O1xuICAgICAgICBsZXQgZ2VhciA9IGNyZWF0ZUdlYXIobXgsIGQsIDAuNDUsIDAuNTIsIDAuMDIpO1xuICAgICAgICBsZXQgZ2VhckNvbCA9IDAuNSswLjUqY3JlYXRlTWV0YWxQbGF0ZShhdGFuKjEsIGQpO1xuICAgICAgICBibGFkZSA9IG1peChtaXgoc2hhZG93LCBibGFkZSwgYmxhZGVBbHBoYSksIGdlYXIqMC4zKmdlYXJDb2wsIGdlYXIpO1xuICAgICAgICByZXR1cm4gbmV3Q29sKGJsYWRlLCBibGFkZSwgYmxhZGUsIGJsYWRlQWxwaGErKDEtc2hhZG93KSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGltYWdlO1xuXG59O1xuXG5jb25zdCBjcmVhdGVJbm5lclNoYWRvdyA9ICh2OiBWZWMyKTogQ29sb3IgPT4ge1xuICAgIGNvbnN0IGQgPSBsZW5WKHYpICogMjtcbiAgICBjb25zdCBkbSA9IGxlblYoc3ViVih2LCBtdWxWUyh2MTEsIDAuMDUpKSkgKiAyO1xuICAgIGNvbnN0IHZhbCA9IHNtb290aHN0ZXAoMSwgMC41LCBkbSAqIDAuOCkgKiAwLjI7XG4gICAgY29uc3QgYSA9IHNtb290aHN0ZXAoMSwgMC44NSwgZCk7XG4gICAgcmV0dXJuIG5ld0NvbCh2YWwsIHZhbCwgdmFsLCBhKTtcbn07XG5jb25zdCBjcmVhdGVMZWRHbGFzcyA9ICh2OiBWZWMyKTogQ29sb3IgPT4ge1xuICAgIGNvbnN0IGQgPSAobGVuVih2KSAqIDIpICogMS4yO1xuICAgIGNvbnN0IHZhbCA9IHNtb290aHN0ZXAoMSwgMC4wLCBkKSAqIDAuMjU7XG4gICAgY29uc3QgYSA9IHNtb290aHN0ZXAoMC45OSwgMC45LCBkKTtcbiAgICByZXR1cm4gbmV3Q29sKHZhbCwgdmFsLCB2YWwsIGEpO1xufTtcbmNvbnN0IGNyZWF0ZUxlZEdsYXNzUmVmbGVjdGlvbiA9ICh2OiBWZWMyKTogQ29sb3IgPT4ge1xuICAgIGNvbnN0IGQgPSAobGVuVih2KSAqIDIpICogMS41O1xuICAgIGNvbnN0IGRtID0gbGVuVihzdWJWKHYsIG11bFZTKHYxMSwgMC4xNCkpKSAqIDEuMDE7XG4gICAgY29uc3QgdmFsID0gc21vb3Roc3RlcCgxLCAwLjYsIGQpICpcbiAgICAgICAgc21vb3Roc3RlcCgwLjIsIDAuNSwgZG0pO1xuICAgIHJldHVybiBuZXdDb2wodmFsLCB2YWwsIHZhbCwgdmFsKTtcbn07XG5jb25zdCBjcmVhdGVMZWRTcHJpdGUgPSAoKTogQ2FudmFzID0+IGdlbmVyYXRlSW1hZ2UoMjEsIDIxLCB2ID0+IHtcbiAgICBjb25zdCBjdiA9IHN1YlYodiwgaGFsZlYpO1xuICAgIGNvbnN0IGlubmVyU2hhZG93ID0gY3JlYXRlSW5uZXJTaGFkb3coY3YpO1xuICAgIGNvbnN0IGxlZEdsYXNzID0gY3JlYXRlTGVkR2xhc3MoY3YpO1xuICAgIGNvbnN0IGxlZEdsYXNzUmVmbGVjdGlvbiA9IGNyZWF0ZUxlZEdsYXNzUmVmbGVjdGlvbihjdik7XG5cbiAgICByZXR1cm4gYWRkQ29sKGFkZENvbChpbm5lclNoYWRvdywgbGVkR2xhc3MpLCBsZWRHbGFzc1JlZmxlY3Rpb24pO1xufSk7XG5cbmNvbnN0IHdoaXRlID0gbmV3Q29sKDEsIDEsIDEsIDEpO1xuY29uc3QgY3JlYXRlR2xvdyA9IChjb2xvcjpDb2xvcik6IENhbnZhcyA9PiBnZW5lcmF0ZUltYWdlKDgwLCA4MCwgdiA9PiB7XG4gICAgY29uc3QgY3YgPSBzdWJWKHYsIGhhbGZWKTtcbiAgICBjb25zdCBkID0gMSAtIGxlblYoY3YpICogMjtcbiAgICBjb25zdCByZXN1bHQgPSBtaXhDb2woY29sb3IsIHdoaXRlLCBzbW9vdGhzdGVwKDAuNiwgMC44OSwgZCkpO1xuXG4gICAgY29uc3QgYSA9IHNtb290aHN0ZXAoMC4wLCAxLCBkKTtcbiAgICByZXR1cm4gbmV3Q29sKHJlc3VsdC5yLCByZXN1bHQuZywgcmVzdWx0LmIsIGEqYSphKTtcbn0pO1xuXG5jb25zdCBjcmVhdGVNZXRhbCA9IChhOiBudW1iZXIsIGQ6IG51bWJlcik6IG51bWJlciA9PiB7XG4gICAgcmV0dXJuIDAuOSArIDAuMSAqIE1hdGguc2luKGEgKiA2KSAqIDAuOSArIDAuMSAqIE1hdGguc2luKGEgKiA0KVxuICAgICAgICAtIChub2lzZSh7eDogKGEgKyA0ICsgZCAqIDUpICogMiwgeTogZCAqIDgwfSkgKiAwLjEpO1xufTtcblxuY29uc3QgY3JlYXRlUmluZ0dsb3cgPSAoY29sb3I6Q29sb3IpOiBDYW52YXMgPT4gZ2VuZXJhdGVJbWFnZSg2MiwgNjIsIHYgPT4ge1xuICAgIGNvbnN0IGN2ID0gc3ViVih2LCBoYWxmVik7XG4gICAgY29uc3QgZCA9IDEgLSBsZW5WKGN2KSAqIDI7XG4gICAgY29uc3QgcmVzdWx0ID0gbWl4Q29sKGNvbG9yLCB3aGl0ZSwgc21vb3Roc3RlcCgwLjQ1LCAwLjUsIGQpKnNtb290aHN0ZXAoMC41NSwgMC41LCBkKSk7XG4gICAgY29uc3QgYSA9IHNtb290aHN0ZXAoMC4wLCAwLjUsIGQpKnNtb290aHN0ZXAoMSwgMC41LCBkKTtcbiAgICByZXR1cm4gbmV3Q29sKHJlc3VsdC5yLCByZXN1bHQuZywgcmVzdWx0LmIsIGEqYSphKTtcbn0pO1xuXG5cbmNvbnN0IGNyZWF0ZUNvbm5lY3RvckJ1dHRvbnMgPSAobGlnaHRDb2xvcjpDb2xvciwgc2l6ZTpudW1iZXIpOiBDYW52YXMgPT4ge1xuICAgIGNvbnN0IHNoYWRvd0JsdXIgPSAwLjI7XG4gICAgY29uc3Qgc2hhZG93RGlzdGFuY2UgPSAwLjA0O1xuICAgIGNvbnN0IHNoYWRvd1NjYWxlID0gMS4xO1xuICAgIGNvbnN0IHNoYWRvd1N0cmVuZ3RoID0gMC4yO1xuICAgIGNvbnN0IGltYWdlID0gZ2VuZXJhdGVJbWFnZShzaXplLCBzaXplLCB2ID0+IHtcbiAgICAgICAgdiA9IG11bFZTKHYsIDEuMSk7IC8vIHNjYWxlIHRvIG1ha2Ugcm9vbSBmb3Igc2hhZG93XG4gICAgICAgIGNvbnN0IGN2ID0gc3ViVih2LCBoYWxmVik7XG5cbiAgICAgICAgY29uc3QgYXRhbiA9IE1hdGguYXRhbjIoY3YueSwgY3YueCk7XG4gICAgICAgIGNvbnN0IHB5ID0gbGVuVihjdikgKiAyO1xuXG4gICAgICAgIC8vIGJhY2tcbiAgICAgICAgY29uc3QgYmFja0FscGhhID0gc21vb3Roc3RlcCgxLCAuOTYsIHB5KTtcbiAgICAgICAgbGV0IHNoYWRpbmcgPSBzbW9vdGhzdGVwKDAuOSwgMC44MCwgcHkpKjAuMyswLjM7XG4gICAgICAgIHNoYWRpbmcgLT0gc21vb3Roc3RlcCgwLjcsIDAuNjAsIHB5KSAqIHNtb290aHN0ZXAoMC4yLCAwLjMwLCBweSkgKiAwLjQ7XG4gICAgICAgIGNvbnN0IGJhY2tWYWwgPSBjcmVhdGVNZXRhbChhdGFuKyhzaGFkaW5nKjMpLCBweSkgKiBzaGFkaW5nO1xuICAgICAgICBjb25zdCBiYWNrQ29sID0gbmV3Q29sKGJhY2tWYWwsIGJhY2tWYWwsIGJhY2tWYWwsIGJhY2tBbHBoYSk7XG5cbiAgICAgICAgLy8gbGlnaHRcbiAgICAgICAgY29uc3QgbGlnaHRBbHBoYSA9IHNtb290aHN0ZXAoMC4zNSwgMC40NSwgcHkpKnNtb290aHN0ZXAoMC41NSwgMC40NSwgcHkpO1xuXG4gICAgICAgIGNvbnN0IGNvbCA9IG1peENvbChiYWNrQ29sLCBsaWdodENvbG9yLCBsaWdodEFscGhhKTtcbiAgICAgICAgY29uc3Qgc2hhZG93ID0gc21vb3Roc3RlcCgxLCAxIC0gc2hhZG93Qmx1ciwgbGVuVihzdWJWKGN2LCB7XG4gICAgICAgICAgICB4OiBzaGFkb3dEaXN0YW5jZSxcbiAgICAgICAgICAgIHk6IHNoYWRvd0Rpc3RhbmNlXG4gICAgICAgIH0pKSAqIDIgLyBzaGFkb3dTY2FsZSkgKiBzaGFkb3dTdHJlbmd0aDtcbiAgICAgICAgY29uc3Qgc2hhZG93Q29sID0gbmV3Q29sKDAsIDAsIDAsIHNoYWRvdyk7XG4gICAgICAgIHJldHVybiBtaXhDb2woY29sLCBzaGFkb3dDb2wsIHNtb290aHN0ZXAoMC44LCAxLCBweSkpO1xuICAgIH0pO1xuICAgIHJldHVybiBpbWFnZTtcbn07XG5cbmNvbnN0IGNyZWF0ZUdhbWVCYWNrZ3JvdW5kID0gKCk6IENhbnZhcyA9PiB7XG4gICAgY29uc3QgW2NhbnZhcywgY29udGV4dF0gPSBjcmVhdGVDYW52YXMoMTkyMCwgMTI4MCk7XG4gICAgY29uc3QgaW1hZ2UgPSBnZW5lcmF0ZUltYWdlKDY0LCA2NCwgdiA9PiB7XG4gICAgICAgIGNvbnN0IG0gPSBtdWxWUyh2LCA0KTtcbiAgICAgICAgY29uc3QgY29sID0gMS1zbW9vdGhzdGVwKDAuNywgMSwgY3JlYXRlSGV4RmllbGQobSwgMSkpKjAuNztcbiAgICAgICAgcmV0dXJuIG5ld0NvbChjb2wgKiAwLjExNywgY29sICogMC4xNDksIGNvbCAqIDAuMTg4LCAxKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGhpZ2hsaWdodCA9IGdlbmVyYXRlSW1hZ2UoMTI4KjIsIDcyKjIsIHYgPT4ge1xuICAgICAgICBjb25zdCB3ID0gMC4wMTtcbiAgICAgICAgY29uc3QgYyA9IHNtb290aHN0ZXAoMCwgdyowLjYsIHYueCkqc21vb3Roc3RlcCgxLCAxLXcqMC42LCB2LngpKlxuICAgICAgICAgICAgc21vb3Roc3RlcCgwLCB3LCB2LnkpKnNtb290aHN0ZXAoMSwgMS13LCB2LnkpO1xuXG4gICAgICAgIHJldHVybiBuZXdDb2woMSwgMSwgMSwgKDEtYykqMC4wNCk7XG4gICAgfSk7XG5cbiAgICBmb3IgKGxldCB5ID0gMDsgeSA8IDEyOyB5KyspIHtcbiAgICAgICAgZm9yIChsZXQgeCA9IDA7IHggPCAyNDsgeCsrKSB7XG4gICAgICAgICAgICBjb250ZXh0LmRyYXdJbWFnZShpbWFnZSwgeCAqIDU0LCB5ICogNjMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29udGV4dC5kcmF3SW1hZ2UoaGlnaGxpZ2h0LCAwLCAwLCAxMjgwLCA3MjApO1xuICAgIHJldHVybiBjYW52YXM7XG59O1xuXG4iLCJcbmNvbnN0IGVsZW1lbnRCeUlkID0gKGlkOiBhbnkpID0+IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKTtcblxuY29uc3QgdGl0bGVFbGVtZW50ID0gZWxlbWVudEJ5SWQoJ3RpdGxlJykgYXMgSFRNTEVsZW1lbnQ7XG5jb25zdCBnYW1lRWxlbWVudCA9IGVsZW1lbnRCeUlkKCdnYW1lJykgYXMgSFRNTEVsZW1lbnQ7XG5jb25zdCBsb2FkaW5nRWxlbWVudCA9IGVsZW1lbnRCeUlkKCdsb2FkaW5nJykgYXMgSFRNTEVsZW1lbnQ7XG5jb25zdCBtZW51RWxlbWVudCA9IGVsZW1lbnRCeUlkKCdtZW51JykgYXMgSFRNTEVsZW1lbnQ7XG5jb25zdCBsZXZlbERvbmVFbGVtZW50ID0gZWxlbWVudEJ5SWQoJ2xldmVsRG9uZScpIGFzIEhUTUxFbGVtZW50O1xuY29uc3QgbmV4dE1zZyA9IGVsZW1lbnRCeUlkKCduZXh0TXNnJykgYXMgSFRNTEVsZW1lbnQ7XG5jb25zdCBuZXh0QnRuID0gZWxlbWVudEJ5SWQoJ25leHRCdG4nKSBhcyBIVE1MRWxlbWVudDtcbmNvbnN0IHN0YXJ0QnRuID0gZWxlbWVudEJ5SWQoJ3N0YXJ0QnRuJykgYXMgSFRNTEVsZW1lbnQ7XG5jb25zdCBjb250aW51ZUJ0biA9IGVsZW1lbnRCeUlkKCdjb250aW51ZUJ0bicpIGFzIEhUTUxFbGVtZW50O1xuY29uc3QgY29udGVudEVsZW1lbnQgPSBlbGVtZW50QnlJZCgnY29udGVudCcpIGFzIEhUTUxFbGVtZW50O1xuY29uc3QgcmVzZXRFbGVtZW50ID0gZWxlbWVudEJ5SWQoJ3Jlc2V0JykgYXMgSFRNTEVsZW1lbnQ7XG5jb25zdCByZXNldEJ0biA9IGVsZW1lbnRCeUlkKCdyZXNldEJ0bicpIGFzIEhUTUxFbGVtZW50O1xuY29uc3QgbGV2ZWxJbmZvID0gZWxlbWVudEJ5SWQoJ2xldmVsSW5mbycpIGFzIEhUTUxFbGVtZW50O1xuY29uc3Qgbm9kZUluZm8gPSBlbGVtZW50QnlJZCgnbm9kZUluZm8nKSBhcyBIVE1MRWxlbWVudDtcbmNvbnN0IGRlc2NyaXB0aW9uRWxlbWVudCA9IGVsZW1lbnRCeUlkKCdkZXNjcmlwdGlvbicpIGFzIEhUTUxFbGVtZW50O1xuXG5jb25zdCBza2lwQnRuID0gZWxlbWVudEJ5SWQoJ3NraXBCdG4nKSBhcyBIVE1MRWxlbWVudDtcbmNvbnN0IGJhY2tCdG4gPSBlbGVtZW50QnlJZCgnYmFja0J0bicpIGFzIEhUTUxFbGVtZW50O1xuXG5jb25zdCBzYXZlTGV2ZWwgPSAobGV2ZWw6IG51bWJlcikgPT4ge1xuICAgIHRyeSB7XG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdsZXZlbCcsICcnICsgbGV2ZWwpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gSUUgYW5kIGVkZ2UgZG9uJ3Qgc3VwcG9ydCBsb2NhbHN0b3JhZ2Ugd2hlbiBvcGVuaW5nIHRoZSBmaWxlIGZyb20gZGlza1xuICAgIH1cbn07XG5cbmNvbnN0IGxvYWRMZXZlbCA9ICgpOiBudW1iZXIgPT4ge1xuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBwYXJzZUludChsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbGV2ZWwnKSEpIHx8IDA7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG59O1xuXG5jb25zdCByZW1vdmVFbGVtZW50ID0gKGVsZW1lbnQ6IEhUTUxFbGVtZW50KSA9PiB7XG4gICAgZWxlbWVudC5wYXJlbnROb2RlIS5yZW1vdmVDaGlsZChlbGVtZW50KTtcbn07XG5cbmNvbnN0IGZhZGVUaW1lID0gMC40O1xuXG5jb25zdCBzaG93RWxlbWVudCA9IChlbGVtZW50OiBIVE1MRWxlbWVudCB8IEhUTUxFbGVtZW50W10sIG9uQ29tcGxldGU/OiAoKSA9PiB2b2lkKSA9PiB7XG4gICAgbGV0IGVsZW1lbnRzID0gQXJyYXkuaXNBcnJheShlbGVtZW50KSA/IGVsZW1lbnQgOiBbZWxlbWVudF07XG4gICAgZWxlbWVudHMuZm9yRWFjaChlID0+IHtcbiAgICAgICAgZS5zdHlsZS52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xuICAgICAgICBlLnN0eWxlLm9wYWNpdHkgPSAnMCc7XG4gICAgfSk7XG4gICAgdHdlZW4oMCwgMSwgZmFkZVRpbWUsXG4gICAgICAgICh0KSA9PiB7XG4gICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGUgPT4ge1xuICAgICAgICAgICAgICAgIGUuc3R5bGUub3BhY2l0eSA9IHQudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICBvbkNvbXBsZXRlICYmIG9uQ29tcGxldGUoKTtcbiAgICAgICAgfVxuICAgICk7XG59O1xuXG5jb25zdCBoaWRlRWxlbWVudCA9IChlbGVtZW50OiBIVE1MRWxlbWVudCB8IEhUTUxFbGVtZW50W10sIG9uQ29tcGxldGU/OiAoKSA9PiB2b2lkKSA9PiB7XG4gICAgbGV0IGVsZW1lbnRzID0gQXJyYXkuaXNBcnJheShlbGVtZW50KSA/IGVsZW1lbnQgOiBbZWxlbWVudF07XG4gICAgdHdlZW4oMSwgMCwgZmFkZVRpbWUsXG4gICAgICAgICh0KSA9PiB7XG4gICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGUgPT4ge1xuICAgICAgICAgICAgICAgIGUuc3R5bGUub3BhY2l0eSA9IHQudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICBlbGVtZW50cy5mb3JFYWNoKGUgPT4ge1xuICAgICAgICAgICAgICAgIGUuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBvbkNvbXBsZXRlICYmIG9uQ29tcGxldGUoKTtcbiAgICAgICAgfVxuICAgICk7XG59O1xuIiwidHlwZSBNb3VzZSA9IHsgcG9zOiBWZWMyLCBsZWZ0RG93bjogYm9vbGVhbjsgfVxudHlwZSBJbnB1dENhbGxiYWNrID0gKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xudHlwZSBJbnB1dENhbGxiYWNrcyA9IHtcbiAgICBtb3VzZU92ZXI/OiBJbnB1dENhbGxiYWNrO1xuICAgIG1vdXNlT3V0PzogSW5wdXRDYWxsYmFjaztcbiAgICBtb3VzZURvd24/OiBJbnB1dENhbGxiYWNrO1xuICAgIG1vdXNlVXA/OiBJbnB1dENhbGxiYWNrO1xuICAgIG1vdXNlRG93blVwZGF0ZT86IElucHV0Q2FsbGJhY2s7XG59XG5cbmludGVyZmFjZSBJbnB1dENvbnRyb2wge1xuICAgIG1vdXNlUG9zOiBWZWMyO1xuICAgIGlzTW91c2VEb3duOiAoKT0+Ym9vbGVhbjtcblxuICAgIHRhcmdldHM6IFtNb3VzZURyYWdFbnRpdHksIElucHV0Q2FsbGJhY2tzXVtdO1xuXG4gICAgc2h1dGRvd24oKTogdm9pZDtcblxuICAgIHVwZGF0ZSgpOiB2b2lkO1xuXG4gICAgZHJhZ0NvbnRyb2wodGFyZ2V0OiBNb3VzZURyYWdFbnRpdHksIGNhbGxiYWNrczogSW5wdXRDYWxsYmFja3MpOiB2b2lkO1xufVxuXG5jb25zdCBjcmVhdGVJbnB1dENvbnRyb2wgPSAoY2FudmFzOiBDYW52YXMpOiBJbnB1dENvbnRyb2wgPT4ge1xuICAgIGxldCBtb3VzZURvd246IGJvb2xlYW4gPSBmYWxzZTtcbiAgICBjb25zdCBtb3VzZVBvczogVmVjMiA9IHt4OiAwLCB5OiAwfTtcblxuICAgIGNvbnN0IG1vdXNlT3ZlclRhcmdldHM6IFtNb3VzZURyYWdFbnRpdHksIElucHV0Q2FsbGJhY2tzXVtdID0gW107XG4gICAgY29uc3QgbW91c2VPdXRUYXJnZXRzOiBbTW91c2VEcmFnRW50aXR5LCBJbnB1dENhbGxiYWNrc11bXSA9IFtdO1xuICAgIGNvbnN0IG1vdXNlRG93blRhcmdldHM6IFtNb3VzZURyYWdFbnRpdHksIElucHV0Q2FsbGJhY2tzXVtdID0gW107XG5cbiAgICBjb25zdCBtb3VzZU1vdmVMaXN0ZW5lciA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgIGxldCByZWN0ID0gY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICBtb3VzZVBvcy54ID0gZS5jbGllbnRYIC0gcmVjdC5sZWZ0O1xuICAgICAgICBtb3VzZVBvcy55ID0gZS5jbGllbnRZIC0gcmVjdC50b3A7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB9O1xuICAgIGNvbnN0IG1vdXNlRG93bkxpc3RlbmVyID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgbW91c2VEb3duID0gdHJ1ZTtcbiAgICAgICAgbW91c2VPdmVyVGFyZ2V0cy5mb3JFYWNoKHdhdGNoID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1vdXNlRG93bkNhbGxiYWNrID0gd2F0Y2hbMV0ubW91c2VEb3duO1xuICAgICAgICAgICAgbW91c2VEb3duQ2FsbGJhY2sgJiYgbW91c2VEb3duQ2FsbGJhY2soKTtcbiAgICAgICAgICAgIG1vdXNlRG93blRhcmdldHMucHVzaCh3YXRjaCk7XG4gICAgICAgIH0pO1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfTtcbiAgICBjb25zdCBtb3VzZVVwTGlzdGVuZXIgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICBtb3VzZURvd24gPSBmYWxzZTtcbiAgICAgICAgbW91c2VEb3duVGFyZ2V0cy5mb3JFYWNoKHdhdGNoID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1vdXNlVXBDYWxsYmFjayA9IHdhdGNoWzFdLm1vdXNlVXA7XG4gICAgICAgICAgICBtb3VzZVVwQ2FsbGJhY2sgJiYgbW91c2VVcENhbGxiYWNrKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBtb3VzZURvd25UYXJnZXRzLmxlbmd0aCA9IDA7XG4gICAgfTtcblxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG1vdXNlTW92ZUxpc3RlbmVyKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBtb3VzZURvd25MaXN0ZW5lcik7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG1vdXNlVXBMaXN0ZW5lcik7XG5cbiAgICBjb25zdCBkcmFnQ29udHJvbCA9ICh0YXJnZXQ6IE1vdXNlRHJhZ0VudGl0eSwgY2FsbGJhY2tzOiBJbnB1dENhbGxiYWNrcykgPT4ge1xuICAgICAgICBtb3VzZU91dFRhcmdldHMucHVzaChbdGFyZ2V0LCBjYWxsYmFja3NdKTtcbiAgICB9O1xuXG4gICAgY29uc3QgdXBkYXRlID0gKCkgPT4ge1xuICAgICAgICBmb3IgKGxldCBpID0gbW91c2VPdXRUYXJnZXRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICAgICAgICBjb25zdCB3YXRjaCA9IG1vdXNlT3V0VGFyZ2V0c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGNhbGxiYWNrcyA9IHdhdGNoWzFdO1xuICAgICAgICAgICAgaWYgKGRpc3RWKG1vdXNlUG9zLCB3YXRjaFswXS5wb3MpIDw9IHdhdGNoWzBdLm1vdXNlRHJhZy5zaXplKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzLm1vdXNlT3ZlciAmJiBjYWxsYmFja3MubW91c2VPdmVyKCk7XG4gICAgICAgICAgICAgICAgbW91c2VPdXRUYXJnZXRzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICBtb3VzZU92ZXJUYXJnZXRzLnB1c2god2F0Y2gpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSBtb3VzZU92ZXJUYXJnZXRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICAgICAgICBjb25zdCB3YXRjaCA9IG1vdXNlT3ZlclRhcmdldHNbaV07XG4gICAgICAgICAgICBjb25zdCBjYWxsYmFja3MgPSB3YXRjaFsxXTtcblxuICAgICAgICAgICAgbW91c2VEb3duICYmIGNhbGxiYWNrcy5tb3VzZURvd25VcGRhdGUgJiYgY2FsbGJhY2tzLm1vdXNlRG93blVwZGF0ZSgpO1xuICAgICAgICAgICAgaWYgKGRpc3RWKG1vdXNlUG9zLCB3YXRjaFswXS5wb3MpID4gd2F0Y2hbMF0ubW91c2VEcmFnLnNpemUpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFja3MubW91c2VPdXQgJiYgY2FsbGJhY2tzLm1vdXNlT3V0KCk7XG4gICAgICAgICAgICAgICAgbW91c2VPdmVyVGFyZ2V0cy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgbW91c2VPdXRUYXJnZXRzLnB1c2god2F0Y2gpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcbiAgICBjb25zdCBzaHV0ZG93biA9ICgpID0+IHtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgbW91c2VNb3ZlTGlzdGVuZXIpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBtb3VzZURvd25MaXN0ZW5lcik7XG4gICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBtb3VzZVVwTGlzdGVuZXIpO1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICB1cGRhdGUsXG4gICAgICAgIGRyYWdDb250cm9sLFxuICAgICAgICBtb3VzZVBvcyxcbiAgICAgICAgaXNNb3VzZURvd246ICgpID0+IChtb3VzZURvd24pLFxuICAgICAgICBzaHV0ZG93bixcbiAgICAgICAgdGFyZ2V0czptb3VzZU92ZXJUYXJnZXRzXG4gICAgfTtcbn07XG5cblxuXG4iLCJjb25zdCBjcmVhdGVMZXZlbEVkaXRvclN5c3RlbSA9IChzcGFjZTogU3BhY2UsIGlucHV0Q29udHJvbDogSW5wdXRDb250cm9sKTogVXBkYXRlU3lzdGVtID0+IHtcbiAgICBjb25zdCBtb3VzZVdoZWVsTGlzdGVuZXIgPSAoZTogV2hlZWxFdmVudCkgPT4ge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGNvbnN0IHNwb29sID0gKGlucHV0Q29udHJvbC50YXJnZXRzWzBdWzBdIGFzIEVudGl0eSkuc3Bvb2wgfHwgKGlucHV0Q29udHJvbC50YXJnZXRzWzBdWzBdIGFzIEVudGl0eSkuYmxvY2s7XG5cbiAgICAgICAgaWYgKCFzcG9vbCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGxldCBtaW4gPSAzMDtcbiAgICAgICAgbGV0IG1heCA9IDE2MDtcbiAgICAgICAgaWYgKHNwb29sLnR5cGUgPT0gTm9kZVR5cGUuaXNvbGF0b3IpIHtcbiAgICAgICAgICAgIG1heCA9IDgwO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGUuZGVsdGFZIDwgMCkge1xuICAgICAgICAgICAgc3Bvb2wuc2l6ZSAhPT0gbWF4ICYmIChzcG9vbC5zaXplICs9IDEwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNwb29sLnNpemUgIT09IG1pbiAmJiAoc3Bvb2wuc2l6ZSAtPSAxMCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3Qga2V5ZG93bkxpc3RlbmVyID0gKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcbiAgICAgICAgaWYgKGUua2V5ID09PSAnMScpIHtcbiAgICAgICAgICAgIGNvbnN0IHNwb29sRW50aXR5OiBTcG9vbE5vZGVFbnRpdHkgPSB7XG4gICAgICAgICAgICAgICAgcG9zOiB7eDogaW5wdXRDb250cm9sLm1vdXNlUG9zLnggLSAxLCB5OiBpbnB1dENvbnRyb2wubW91c2VQb3MueX0sXG4gICAgICAgICAgICAgICAgc3Bvb2w6IHtzaXplOiA1MCwgdHlwZTogTm9kZVR5cGUuc3Bvb2x9LFxuICAgICAgICAgICAgICAgIHJlbmRlcjoge3R5cGU6IE5vZGVUeXBlLnNwb29sfSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvLyAoc3Bvb2xFbnRpdHkgYXMgYW55KS5tb3VzZURyYWcgPSB7c2l6ZTogMjB9O1xuICAgICAgICAgICAgc3BhY2UuYWRkRW50aXR5KHNwb29sRW50aXR5KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZS5rZXkgPT09ICcyJykge1xuICAgICAgICAgICAgY29uc3Qgc3Bvb2xFbnRpdHk6IEJsb2NrTm9kZUVudGl0eSA9IHtcbiAgICAgICAgICAgICAgICBwb3M6IHt4OiBpbnB1dENvbnRyb2wubW91c2VQb3MueCwgeTogaW5wdXRDb250cm9sLm1vdXNlUG9zLnl9LFxuICAgICAgICAgICAgICAgIGJsb2NrOiB7c2l6ZTogNTB9LFxuICAgICAgICAgICAgICAgIHJlbmRlcjoge3R5cGU6IE5vZGVUeXBlLmJsb2NrfSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvLyAoc3Bvb2xFbnRpdHkgYXMgYW55KS5tb3VzZURyYWcgPSB7c2l6ZTogMjB9O1xuICAgICAgICAgICAgc3BhY2UuYWRkRW50aXR5KHNwb29sRW50aXR5KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZS5rZXkgPT09ICczJykge1xuICAgICAgICAgICAgY29uc3Qgc3Bvb2xFbnRpdHk6IFNwb29sTm9kZUVudGl0eSA9IHtcbiAgICAgICAgICAgICAgICBwb3M6IHt4OiBpbnB1dENvbnRyb2wubW91c2VQb3MueCwgeTogaW5wdXRDb250cm9sLm1vdXNlUG9zLnl9LFxuICAgICAgICAgICAgICAgIHNwb29sOiB7c2l6ZTogNDAsIHR5cGU6IE5vZGVUeXBlLmlzb2xhdG9yfSxcbiAgICAgICAgICAgICAgICByZW5kZXI6IHt0eXBlOiBOb2RlVHlwZS5pc29sYXRvcn0sXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgLy8gKHNwb29sRW50aXR5IGFzIGFueSkubW91c2VEcmFnID0ge3NpemU6IDIwfTtcbiAgICAgICAgICAgIHNwYWNlLmFkZEVudGl0eShzcG9vbEVudGl0eSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGUua2V5ID09PSAnRjInKSB7XG4gICAgICAgICAgICBjb25zdCBsZXZlbDogUGFydGlhbDxMZXZlbERhdGE+ID0ge3Nwb29sczogW10sIGlzb2xhdG9yczogW10sIGJsb2NrczogW119O1xuICAgICAgICAgICAgc3BhY2UuZW50aXRpZXMuZm9yRWFjaChlbnRpdHkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlbnRpdHkuc3Bvb2wpIHtcbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoIChlbnRpdHkuc3Bvb2wudHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBOb2RlVHlwZS5zcG9vbDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXZlbC5zcG9vbHMhLnB1c2goW2VudGl0eS5wb3MhLngsIGVudGl0eS5wb3MhLnksIGVudGl0eS5zcG9vbC5zaXplXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIE5vZGVUeXBlLnN0YXJ0OlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldmVsLnN0YXJ0ID0gW2VudGl0eS5wb3MhLngsIGVudGl0eS5wb3MhLnldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBOb2RlVHlwZS5lbmQ6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWwuZW5kID0gWzExMCwgMzYwXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgTm9kZVR5cGUuaXNvbGF0b3I6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV2ZWwuaXNvbGF0b3JzIS5wdXNoKFtlbnRpdHkucG9zIS54LCBlbnRpdHkucG9zIS55LCBlbnRpdHkuc3Bvb2whLnNpemVdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoZW50aXR5LmZpbmlzaCkge1xuICAgICAgICAgICAgICAgICAgICBsZXZlbC5maW5pc2ggPSBbZW50aXR5LnBvcyEueCwgZW50aXR5LnBvcyEueV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChlbnRpdHkuYmxvY2spIHtcbiAgICAgICAgICAgICAgICAgICAgbGV2ZWwuYmxvY2tzIS5wdXNoKFtlbnRpdHkucG9zIS54LCBlbnRpdHkucG9zIS55LCBlbnRpdHkuYmxvY2suc2l6ZV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeShsZXZlbCkpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywga2V5ZG93bkxpc3RlbmVyKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignd2hlZWwnLCBtb3VzZVdoZWVsTGlzdGVuZXIpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgYWRkRW50aXR5OiBlbnRpdHkgPT4ge1xuICAgICAgICAgICAgaWYgKGVudGl0eS5zcG9vbCkge1xuICAgICAgICAgICAgICAgIGlmIChlbnRpdHkuc3Bvb2wudHlwZSAhPSBOb2RlVHlwZS5lbmQpIHtcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5Lm1vdXNlRHJhZyA9IHtzaXplOiBlbnRpdHkuc3Bvb2wuc2l6ZX07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZW50aXR5LmJsb2NrKSB7XG4gICAgICAgICAgICAgICAgZW50aXR5Lm1vdXNlRHJhZyA9IHtzaXplOiBlbnRpdHkuYmxvY2suc2l6ZX07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHVwZGF0ZTogKHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICB9LFxuICAgICAgICBzaHV0ZG93bjogKCkgPT4ge1xuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBrZXlkb3duTGlzdGVuZXIpO1xuICAgICAgICB9XG4gICAgfTtcbn07XG4iLCJ0eXBlIExldmVsRGF0YSA9IHtcbiAgICBzcG9vbHM6IFtudW1iZXIsIG51bWJlciwgbnVtYmVyXVtdLFxuICAgIGJsb2NrczogW251bWJlciwgbnVtYmVyLCBudW1iZXJdW10sXG4gICAgaXNvbGF0b3JzOiBbbnVtYmVyLCBudW1iZXIsIG51bWJlcl1bXSxcbiAgICBzdGFydDogW251bWJlciwgbnVtYmVyXVxuICAgIGVuZDogW251bWJlciwgbnVtYmVyXVxuICAgIGZpbmlzaDogW251bWJlciwgbnVtYmVyXVxufVxudHlwZSBHYW1lRGF0YSA9IHtcbiAgICBsZXZlbHM6IExldmVsRGF0YVtdO1xufVxuXG5jb25zdCBnYW1lRGF0YTogR2FtZURhdGEgPSB7XG4gICAgbGV2ZWxzOiBbXG4gICAgICAgIC8vIHsgIExFVkVMIFRFTVBMQVRFXG4gICAgICAgIC8vICAgICAnc3Bvb2xzJzogW1s4NjQsIDMzNiwgMTUwXSwgWzU2MCwgMzc4LCA1MF1dLFxuICAgICAgICAvLyAgICAgJ2lzb2xhdG9ycyc6IFtdLFxuICAgICAgICAvLyAgICAgJ2Jsb2Nrcyc6IFtdLFxuICAgICAgICAvLyAgICAgJ3N0YXJ0JzogWzUwLCAzNjBdLFxuICAgICAgICAvLyAgICAgJ2ZpbmlzaCc6IFsxMjMwLCAzNjBdLFxuICAgICAgICAvLyAgICAgJ2VuZCc6IFsxMTAsIDM2MF1cbiAgICAgICAgLy8gfVxuICAgICAgICAvLyAxXG4gICAgICAgIHtcbiAgICAgICAgICAgICdzcG9vbHMnOiBbWzQ2MCwgMjA3LCA3MF0sIFs0NjgsIDUxNiwgNzBdXSxcbiAgICAgICAgICAgICdpc29sYXRvcnMnOiBbXSxcbiAgICAgICAgICAgICdibG9ja3MnOiBbXSxcbiAgICAgICAgICAgICdzdGFydCc6IFs1MCwgMzYwXSxcbiAgICAgICAgICAgICdmaW5pc2gnOiBbMTIzMCwgMzYwXSxcbiAgICAgICAgICAgICdlbmQnOiBbMTEwLCAzNjBdXG4gICAgICAgIH0sLy8gMlxuICAgICAgICB7XG4gICAgICAgICAgICAnc3Bvb2xzJzogW1s0NDAsIDU0MCwgNjBdLCBbODQ2LCA1NTYsIDYwXSwgWzY0NSwgMTczLCA5MF1dLFxuICAgICAgICAgICAgJ2lzb2xhdG9ycyc6IFtdLFxuICAgICAgICAgICAgJ2Jsb2Nrcyc6IFtbNzc3LCAzNjksIDExMF0sIFsyNDksIDQ2MSwgNzBdXSxcbiAgICAgICAgICAgICdzdGFydCc6IFs1MCwgMzYwXSxcbiAgICAgICAgICAgICdmaW5pc2gnOiBbMTIzMCwgMzYwXSxcbiAgICAgICAgICAgICdlbmQnOiBbMTEwLCAzNjBdXG4gICAgICAgIH0sLy8gM1xuICAgICAgICB7XG4gICAgICAgICAgICAnc3Bvb2xzJzogW1s4NzEsIDQ0NywgNTBdLCBbNjU5LCA1OTAsIDUwXSwgWzYyOSwgMjY3LCA0MF1dLFxuICAgICAgICAgICAgJ2lzb2xhdG9ycyc6IFtbNDM4LCA1NjEsIDQwXSwgWzQ5NywgMTQ4LCA0MF1dLFxuICAgICAgICAgICAgJ2Jsb2Nrcyc6IFtbMjQxLCA0MzUsIDcwXSwgWzY3NSwgNDIyLCA5MF0sIFszMjQsIDIxNSwgNTBdXSxcbiAgICAgICAgICAgICdzdGFydCc6IFs1MCwgMzYwXSxcbiAgICAgICAgICAgICdmaW5pc2gnOiBbMTIzMCwgMzYwXSxcbiAgICAgICAgICAgICdlbmQnOiBbMTEwLCAzNjBdXG4gICAgICAgIH0sLy8gNFxuICAgICAgICB7XG4gICAgICAgICAgICAnc3Bvb2xzJzogW1s4NzIsIDQ5NiwgMTMwXSwgWzUwOCwgMjM0LCA2MF0sIFs1MDgsIDQ4NiwgNjBdLCBbODcxLCAxOTAsIDEzMF1dLFxuICAgICAgICAgICAgJ2lzb2xhdG9ycyc6IFtbMjM0LCA1MjUsIDQwXSwgWzIzNywgMTgyLCA0MF1dLFxuICAgICAgICAgICAgJ2Jsb2Nrcyc6IFtbNjY3LCAyODgsIDYwXSwgWzY2OSwgNDI3LCA2MF0sIFs1OTMsIDEzMiwgNjBdLCBbNTk3LCA1ODgsIDYwXV0sXG4gICAgICAgICAgICAnc3RhcnQnOiBbNTAsIDM2MF0sXG4gICAgICAgICAgICAnZmluaXNoJzogWzEyMzAsIDM2MF0sXG4gICAgICAgICAgICAnZW5kJzogWzExMCwgMzYwXVxuICAgICAgICB9LC8vIDVcbiAgICAgICAge1xuICAgICAgICAgICAgJ3Nwb29scyc6IFtbODQ1LCAxNTYsIDcwXSwgWzU5NSwgNDQzLCA2MF0sIFs2NjgsIDYwOSwgNjBdLCBbMzk2LCA0MTYsIDUwXV0sXG4gICAgICAgICAgICAnaXNvbGF0b3JzJzogW1s4MzIsIDM5NiwgNDBdLCBbNTU2LCAyNDcsIDQwXV0sXG4gICAgICAgICAgICAnYmxvY2tzJzogW1s2OTYsIDIwNCwgNjBdLCBbNzIxLCAzOTIsIDYwXSwgWzQ5OCwgMzQ1LCA1MF1dLFxuICAgICAgICAgICAgJ3N0YXJ0JzogWzUwLCAzNjBdLFxuICAgICAgICAgICAgJ2ZpbmlzaCc6IFsxMjMwLCAzNjBdLFxuICAgICAgICAgICAgJ2VuZCc6IFsxMTAsIDM2MF1cbiAgICAgICAgfSwgLy8gNlxuICAgICAgICB7XG4gICAgICAgICAgICAnc3Bvb2xzJzogW1s2NjQsIDMzOCwgNzBdLCBbMzY1LCAxNzEsIDkwXSwgWzkyOSwgMTcwLCA5MF0sIFsxMDExLCA1NTksIDgwXSwgWzM3MiwgNTU4LCA5MF1dLFxuICAgICAgICAgICAgJ2lzb2xhdG9ycyc6IFtbNzI5LCA1NjEsIDQwXSwgWzExNDksIDI2NiwgNDBdXSxcbiAgICAgICAgICAgICdibG9ja3MnOiBbWzc1NywgMjAzLCA3MF0sIFs4NDYsIDM3NSwgNzBdLCBbNTg1LCA1NDksIDgwXSwgWzExNTAsIDQyOSwgNTBdXSxcbiAgICAgICAgICAgICdzdGFydCc6IFs1MCwgMzYwXSxcbiAgICAgICAgICAgICdmaW5pc2gnOiBbMTIzMCwgMzYwXSxcbiAgICAgICAgICAgICdlbmQnOiBbMTEwLCAzNjBdXG4gICAgICAgIH0sIC8vIDdcbiAgICAgICAge1xuICAgICAgICAgICAgJ3Nwb29scyc6IFtbNTAyLCAyNTksIDYwXSwgWzUwOCwgNDU4LCA2MF0sIFs5NzksIDM1NiwgNTBdLCBbMzQ2LCA1NzMsIDYwXSwgWzMxOSwgMTQxLCA2MF1dLFxuICAgICAgICAgICAgJ2lzb2xhdG9ycyc6IFtbNzI0LCAzNjEsIDQwXSwgWzcyMCwgMTQyLCA0MF1dLFxuICAgICAgICAgICAgJ2Jsb2Nrcyc6IFtbNjA5LCAzNTMsIDYwXSwgWzM3OSwgNDUxLCA1MF0sIFs4NDgsIDM2MCwgNzBdXSxcbiAgICAgICAgICAgICdzdGFydCc6IFs1MCwgMzYwXSxcbiAgICAgICAgICAgICdmaW5pc2gnOiBbMTIzMCwgMzYwXSxcbiAgICAgICAgICAgICdlbmQnOiBbMTEwLCAzNjBdXG4gICAgICAgIH0sIC8vIDhcbiAgICAgICAge1xuICAgICAgICAgICAgJ3Nwb29scyc6IFtbOTU3LCAxNTYsIDcwXSwgWzM3OCwgNTcwLCA3MF0sIFs1MDcsIDEwOSwgNjBdXSxcbiAgICAgICAgICAgICdpc29sYXRvcnMnOiBbWzU2OCwgNTM2LCA0MF0sIFszODIsIDE5OCwgNDBdLCBbNjU5LCAxMTIsIDQwXSwgWzk0MCwgMzQ4LCA0MF1dLFxuICAgICAgICAgICAgJ2Jsb2Nrcyc6IFtbNzU2LCA0NDUsIDEwMF0sIFsxMTIyLCAyMzQsIDUwXV0sXG4gICAgICAgICAgICAnc3RhcnQnOiBbNTAsIDM2MF0sXG4gICAgICAgICAgICAnZmluaXNoJzogWzEyMzAsIDM2MF0sXG4gICAgICAgICAgICAnZW5kJzogWzExMCwgMzYwXVxuICAgICAgICB9LCAvLyA5XG4gICAgICAgIHtcbiAgICAgICAgICAgICdzcG9vbHMnOiBbWzYyOSwgMTMwLCA0MF0sIFs4MTEsIDQ4MiwgNTBdLCBbMzg1LCA0OTEsIDUwXSwgWzM4NiwgMzE3LCA1MF0sIFs5NzYsIDU2OSwgNDBdLCBbODQ0LCAxMzksIDYwXSwgWzExNjEsIDEzOCwgNTBdXSxcbiAgICAgICAgICAgICdpc29sYXRvcnMnOiBbWzIyMiwgMjMwLCA0MF0sIFsyMTYsIDU4NywgMzBdXSxcbiAgICAgICAgICAgICdibG9ja3MnOiBbWzYxOSwgMzY3LCAxNjBdLCBbMTAxNSwgMjU1LCAxMzBdXSxcbiAgICAgICAgICAgICdzdGFydCc6IFs1MCwgMzYwXSxcbiAgICAgICAgICAgICdmaW5pc2gnOiBbMTIzMCwgMzYwXSxcbiAgICAgICAgICAgICdlbmQnOiBbMTEwLCAzNjBdXG4gICAgICAgIH0sIC8vIDEwXG4gICAgICAgIHtcbiAgICAgICAgICAgICdzcG9vbHMnOiBbWzkyMiwgNTA5LCAxNTBdLCBbMjU3LCA1NTIsIDYwXSwgWzIwMSwgMjAwLCA1MF0sIFs1MDksIDUxOSwgNTBdLCBbNTIwLCAxMzQsIDUwXSwgWzkzNywgMjU3LCA1MF0sIFsxMTExLCAxMzMsIDUwXV0sXG4gICAgICAgICAgICAnaXNvbGF0b3JzJzogW1s2NzgsIDQ2NSwgNDBdLCBbNjc5LCAyOTEsIDQwXV0sXG4gICAgICAgICAgICAnYmxvY2tzJzogW1s4ODcsIDExMywgODBdLCBbMzkyLCA0MzgsIDcwXSwgWzY5OSwgNTczLCA1MF0sIFsxMTYzLCA0NjgsIDUwXV0sXG4gICAgICAgICAgICAnc3RhcnQnOiBbNTAsIDM2MF0sXG4gICAgICAgICAgICAnZmluaXNoJzogWzEyMzAsIDM2MF0sXG4gICAgICAgICAgICAnZW5kJzogWzExMCwgMzYwXVxuICAgICAgICB9LCAvLyAxMVxuICAgICAgICB7XG4gICAgICAgICAgICAnc3Bvb2xzJzogW1syMjgsIDE5MywgMTUwXSwgWzMyNiwgNTYzLCA4MF0sIFs1NTcsIDIwOSwgNzBdLCBbNzg1LCAxOTksIDUwXSwgWzEwNDMsIDU5MywgODBdLCBbMTAxNSwgMTg4LCAxMzBdLCBbNzkxLCA1NDgsIDUwXSwgWzU0MywgNTQ0LCA1MF0sIFs1MTEsIDM3MywgMzBdLCBbNjg1LCAzMzMsIDMwXV0sXG4gICAgICAgICAgICAnaXNvbGF0b3JzJzogW1s2ODcsIDQ0NiwgMzBdLCBbMTIwNSwgNDU1LCAzMF1dLFxuICAgICAgICAgICAgJ2Jsb2Nrcyc6IFtbNDQyLCAxMTYsIDUwXSwgWzk4MiwgNDAwLCA1MF0sIFsxMjAzLCAyNjUsIDUwXSwgWzExODUsIDU2MywgNTBdLCBbNzc2LCAzODIsIDYwXSwgWzQwOCwgNDI4LCA1MF1dLFxuICAgICAgICAgICAgJ3N0YXJ0JzogWzUwLCAzNjBdLFxuICAgICAgICAgICAgJ2ZpbmlzaCc6IFsxMjMwLCAzNjBdLFxuICAgICAgICAgICAgJ2VuZCc6IFsxMTAsIDM2MF1cbiAgICAgICAgfSwgLy8gMTJcbiAgICAgICAge1xuICAgICAgICAgICAgJ3Nwb29scyc6IFtbNjY5LCAzNTUsIDgwXSwgWzY2OCwgMTg3LCA1MF0sIFs2NjYsIDcwLCAzMF0sIFs2NjgsIDUxNCwgNTBdLCBbNjczLCA2NTMsIDMwXSwgWzQ3MywgMzYxLCA1MF0sIFs4NTIsIDM1MywgNTBdLCBbOTg2LCAzNDgsIDMwXSwgWzMzNSwgMzYxLCAzMF1dLFxuICAgICAgICAgICAgJ2lzb2xhdG9ycyc6IFtdLFxuICAgICAgICAgICAgJ2Jsb2Nrcyc6IFtbODA0LCA0NzYsIDUwXSwgWzU1MiwgMjQ0LCA2MF0sIFs4NTcsIDE3NCwgOTBdLCBbNDg5LCA1NDEsIDgwXV0sXG4gICAgICAgICAgICAnc3RhcnQnOiBbNTAsIDM2MF0sXG4gICAgICAgICAgICAnZmluaXNoJzogWzEyMzAsIDM2MF0sXG4gICAgICAgICAgICAnZW5kJzogWzExMCwgMzYwXVxuICAgICAgICB9LCAvLyAxM1xuICAgICAgICB7XG4gICAgICAgICAgICAnc3Bvb2xzJzogW1s1NDksIDExNCwgNjBdLCBbMjEzLCAzNDUsIDMwXSwgWzM4OSwgMTg2LCA1MF0sIFs4MzQsIDkzLCA3MF0sIFsyOTcsIDI3MiwgNDBdLCBbMzg5LCA1NjQsIDUwXSwgWzYwNiwgNTQyLCA1MF0sIFs4MTUsIDU2NiwgNTBdXSxcbiAgICAgICAgICAgICdpc29sYXRvcnMnOiBbXSxcbiAgICAgICAgICAgICdibG9ja3MnOiBbWzgzOSwgMzAwLCAxMzBdLCBbMTA2MiwgMzQzLCA4MF0sIFs0ODMsIDM1NCwgNTBdLCBbMzM3LCA0MTksIDcwXSwgWzQ4NSwgNTM3LCAzMF0sIFsyMDQsIDUwNywgNTBdXSxcbiAgICAgICAgICAgICdzdGFydCc6IFs1MCwgMzYwXSxcbiAgICAgICAgICAgICdmaW5pc2gnOiBbMTIzMCwgMzYwXSxcbiAgICAgICAgICAgICdlbmQnOiBbMTEwLCAzNjBdXG4gICAgICAgIH0sIC8vIDE0XG4gICAgICAgIHtcbiAgICAgICAgICAgICdzcG9vbHMnOiBbWzQwMiwgMzgwLCA5MF0sIFs3NTgsIDM3OSwgOTBdLCBbODkwLCAxOTUsIDUwXSwgWzMyNCwgMTY2LCA1MF0sIFsxMDM2LCA5MSwgNDBdLCBbMTAzOCwgNDYxLCA1MF0sIFsxMDU1LCA2MjIsIDQwXV0sXG4gICAgICAgICAgICAnaXNvbGF0b3JzJzogW1s2MDAsIDEwMCwgNDBdLCBbNTk1LCA2MTcsIDQwXV0sXG4gICAgICAgICAgICAnYmxvY2tzJzogW1sxNTksIDI1MSwgNTBdLCBbNzMzLCAxNTYsIDcwXSwgWzg4NiwgNTUzLCA4MF0sIFs5ODgsIDMwMywgODBdLCBbMTE2NywgMjM4LCA1MF0sIFsxMDgyLCA1MzYsIDMwXV0sXG4gICAgICAgICAgICAnc3RhcnQnOiBbNTAsIDM2MF0sXG4gICAgICAgICAgICAnZmluaXNoJzogWzEyMzAsIDM2MF0sXG4gICAgICAgICAgICAnZW5kJzogWzExMCwgMzYwXVxuICAgICAgICB9LCAvLyAxNVxuICAgICAgICB7XG4gICAgICAgICAgICAnc3Bvb2xzJzogW1s2NDcsIDM2MCwgMTYwXSwgWzMyNiwgMjMzLCAzMF0sIFs0NjIsIDExMSwgMzBdLCBbNjQ2LCA3MSwgMzBdLCBbODE5LCAxMjAsIDMwXSwgWzkzMiwgMjc3LCAzMF0sIFs5MzAsIDQ2OCwgMzBdLCBbODA5LCA2MDIsIDMwXSwgWzYyNiwgNjQ0LCAzMF0sIFs0MzgsIDU3OSwgMzBdLCBbMzM0LCA0MDQsIDMwXV0sXG4gICAgICAgICAgICAnaXNvbGF0b3JzJzogW1sxODgsIDExOSwgMzBdLCBbMTkyLCA1NjgsIDMwXV0sXG4gICAgICAgICAgICAnYmxvY2tzJzogW1sxMDY5LCAzNjcsIDkwXSwgWzM1NCwgMTM0LCA1MF0sIFs1NjEsIDEwNiwgNDBdLCBbODI4LCAyMzIsIDUwXSwgWzg1NSwgMzkyLCA1MF0sIFs3MTEsIDU3NywgNTBdLCBbNDQ3LCA0NjYsIDUwXSwgWzQzMSwgMjU4LCA2MF1dLFxuICAgICAgICAgICAgJ3N0YXJ0JzogWzUwLCAzNjBdLFxuICAgICAgICAgICAgJ2ZpbmlzaCc6IFsxMjMwLCAzNjBdLFxuICAgICAgICAgICAgJ2VuZCc6IFsxMTAsIDM2MF1cbiAgICAgICAgfSwgLy8gMTZcbiAgICAgICAge1xuICAgICAgICAgICAgJ3Nwb29scyc6IFtbMzM1LCAzMDQsIDUwXSwgWzY1NSwgMjk5LCA2MF0sIFs5NjEsIDE5MSwgNTBdLCBbMzE4LCA1ODQsIDUwXSwgWzY1MCwgNTgwLCA1MF0sIFsxMDA3LCA1OTEsIDUwXSwgWzM0NiwgMTE1LCA0MF0sIFsxMTM5LCAxMzYsIDUwXSwgWzExOTgsIDU4MSwgMzBdLCBbOTAxLCA0OTcsIDMwXV0sXG4gICAgICAgICAgICAnaXNvbGF0b3JzJzogW10sXG4gICAgICAgICAgICAnYmxvY2tzJzogW1sxMDkwLCAyOTQsIDcwXSwgWzk4NSwgNDg3LCA0MF0sIFs3NjUsIDQ4MiwgNjBdLCBbODQ2LCAxOTIsIDUwXSwgWzUzOCwgMTQ5LCA1MF0sIFsxMDM3LCAxMzQsIDMwXSwgWzExMzUsIDUzMCwgMzBdXSxcbiAgICAgICAgICAgICdzdGFydCc6IFs1MCwgMzYwXSxcbiAgICAgICAgICAgICdmaW5pc2gnOiBbMTIzMCwgMzYwXSxcbiAgICAgICAgICAgICdlbmQnOiBbMTEwLCAzNjBdXG4gICAgICAgIH0sXG4gICAgXVxufTtcbiIsImNvbnN0IGNyZWF0ZU1vdXNlRHJhZ1N5c3RlbSA9IChpbnB1dENvbnRyb2w6SW5wdXRDb250cm9sKTogVXBkYXRlU3lzdGVtID0+IHtcblxuICAgIGNvbnN0IHNwOiBWZWMyID0ge3g6IDAsIHk6IDB9O1xuICAgIGNvbnN0IHNwb29sczogRW50aXR5W10gPSBbXTtcbiAgICBsZXQgZHJhZ0VudGl0eTogTW91c2VEcmFnRW50aXR5O1xuICAgIGxldCBmaW5pc2hFbnRpdHk6IEZpbmlzaEVudGl0eTtcbiAgICBsZXQgaXNEcmFnZ2luZyA9IGZhbHNlO1xuICAgIGxldCBpc092ZXIgPSBmYWxzZTtcbiAgICByZXR1cm4ge1xuICAgICAgICBhZGRFbnRpdHk6IGVudGl0eSA9PiB7XG4gICAgICAgICAgICAvLyB3ZSBuZWVkIHRoZSBzcG9vbHMgdG8gY2hlY2sgaWYgd2UgY29sbGlkZVxuICAgICAgICAgICAgaWYgKGVudGl0eS5zcG9vbCAmJiAoZW50aXR5LnNwb29sLnR5cGUgPT09IE5vZGVUeXBlLnNwb29sIHx8IGVudGl0eS5zcG9vbC50eXBlID09PSBOb2RlVHlwZS5pc29sYXRvcikpIHtcbiAgICAgICAgICAgICAgICBzcG9vbHMucHVzaChlbnRpdHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGVudGl0eS5maW5pc2gpIHtcbiAgICAgICAgICAgICAgICBmaW5pc2hFbnRpdHkgPSBlbnRpdHk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChlbnRpdHkubW91c2VEcmFnKSB7XG4gICAgICAgICAgICAgICAgaW5wdXRDb250cm9sLmRyYWdDb250cm9sKGVudGl0eSwge1xuICAgICAgICAgICAgICAgICAgICBtb3VzZU92ZXI6ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzT3ZlciA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5wdXRDb250cm9sLmlzTW91c2VEb3duKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICdwb2ludGVyJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGRyYWdFbnRpdHkgPSBlbnRpdHk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbnRpdHkucmVuZGVyLmhvdmVyID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBtb3VzZU91dDogKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jdXJzb3IgPSAnZGVmYXVsdCc7XG4gICAgICAgICAgICAgICAgICAgICAgICBpc092ZXIgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNEcmFnZ2luZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudGl0eS5yZW5kZXIuaG92ZXIgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBtb3VzZURvd246ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzRHJhZ2dpbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29weUludG9WKHNwLCBzdWJWKGlucHV0Q29udHJvbC5tb3VzZVBvcywgZW50aXR5LnBvcykpO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBtb3VzZVVwOigpPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXNEcmFnZ2luZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc092ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRpdHkucmVuZGVyLmhvdmVyID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgbW91c2VEb3duVXBkYXRlOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB1cGRhdGU6ICh0aW1lOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIGlucHV0Q29udHJvbC51cGRhdGUoKTtcbiAgICAgICAgICAgIGlmICghZHJhZ0VudGl0eSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaXNEcmFnZ2luZyAmJiBjb3B5SW50b1YoZHJhZ0VudGl0eS5wb3MsIHN1YlYoaW5wdXRDb250cm9sLm1vdXNlUG9zLCBzcCkpO1xuXG4gICAgICAgICAgICBjb25zdCB2MSA9IGRyYWdFbnRpdHkucG9zO1xuXG4gICAgICAgICAgICAvLyBwdXNoIGF3YXkgZnJvbSBib3JkZXJcbiAgICAgICAgICAgIHYxLnggPSBjbGFtcCh2MS54LCAwLCAxMjgwKTtcbiAgICAgICAgICAgIHYxLnkgPSBjbGFtcCh2MS55LCAwLCA3MjApO1xuXG4gICAgICAgICAgICAvLyBwdXNoIGVuZCBub2RlIGF3YXkgZnJvbSBzcG9vbHNcbiAgICAgICAgICAgIHNwb29scy5mb3JFYWNoKHNwb29sID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoc3Bvb2wgPT09IGRyYWdFbnRpdHkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCB2MiA9IHNwb29sLnBvcztcbiAgICAgICAgICAgICAgICBjb25zdCBkaXN0ID0gMTAgKyBzcG9vbC5zcG9vbC5zaXplO1xuICAgICAgICAgICAgICAgIGlmIChkaXN0Vih2MSwgdjIpIDwgZGlzdCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkaXIgPSBub3JtYWxpemVWKHN1YlYodjEsIHYyKSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkaXIueCA9PSAwICYmIGRpci55ID09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpci54ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zdCB2ID0gbXVsVlMoZGlyLCBkaXN0KTtcbiAgICAgICAgICAgICAgICAgICAgZHJhZ0VudGl0eS5wb3MgPSBhZGRWKHYyLCB2KTtcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBzbmFwIHRvIGZpbmlzaFxuICAgICAgICAgICAgaWYgKGRpc3RWKHYxLCBmaW5pc2hFbnRpdHkucG9zKSA8IDMwKSB7XG4gICAgICAgICAgICAgICAgZmluaXNoRW50aXR5LmZpbmlzaC5jb25uZWN0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNvcHlJbnRvVihkcmFnRW50aXR5LnBvcywgZmluaXNoRW50aXR5LnBvcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZpbmlzaEVudGl0eS5maW5pc2guY29ubmVjdGVkID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuICAgIH07XG59O1xuIiwiXG5jb25zdCBjcmVhdGVTcG9vbFJlbmRlclN5c3RlbSA9IChyZXNvdXJjZXM6IFJlc291cmNlcyk6IFJlbmRlclN5c3RlbSA9PiB7XG4gICAgY29uc3QgZW50aXRpZXM6IEVudGl0eVtdID0gW107XG4gICAgY29uc3Qge2NvaWxzLCBibG9ja3MsIGlzb2xhdG9ycywgZHJhZywgZmluaXNoLCBzdGFydH0gPSByZXNvdXJjZXM7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBhZGRFbnRpdHk6IChlbnRpdHk6IEVudGl0eSkgPT4ge1xuICAgICAgICAgICAgaWYgKGVudGl0eS5yZW5kZXIpIHtcbiAgICAgICAgICAgICAgICBlbnRpdGllcy5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlbmRlcjogKGNvbnRleHQ6IENvbnRleHQsIHRpbWU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgZW50aXRpZXMuZm9yRWFjaChlbnRpdHkgPT4ge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAoZW50aXR5LnJlbmRlci50eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgTm9kZVR5cGUuc3Bvb2w6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmRyYXdJbWFnZShjb2lsc1tlbnRpdHkuc3Bvb2wuc2l6ZV0sIGVudGl0eS5wb3MueCAtIGVudGl0eS5zcG9vbC5zaXplIC0gNiwgZW50aXR5LnBvcy55IC0gZW50aXR5LnNwb29sLnNpemUgLSA2KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQuZHJhd0ltYWdlKHJlc291cmNlcy5sZWQsIGVudGl0eS5wb3MueCAtIDExLCBlbnRpdHkucG9zLnkgLSAxMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZW50aXR5LnNwb29sLm92ZXJwb3dlcmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5kcmF3SW1hZ2UocmVzb3VyY2VzLnJlZEdsb3csIGVudGl0eS5wb3MueCAtIDQwLCBlbnRpdHkucG9zLnkgLSA0MCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGVudGl0eS5zcG9vbC5wb3dlcmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5kcmF3SW1hZ2UocmVzb3VyY2VzLmdyZWVuR2xvdywgZW50aXR5LnBvcy54IC0gNDAsIGVudGl0eS5wb3MueSAtIDQwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIE5vZGVUeXBlLmlzb2xhdG9yOlxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5kcmF3SW1hZ2UoaXNvbGF0b3JzW2VudGl0eS5zcG9vbC5zaXplXSwgZW50aXR5LnBvcy54IC0gZW50aXR5LnNwb29sLnNpemUgLSA2LCBlbnRpdHkucG9zLnkgLSBlbnRpdHkuc3Bvb2wuc2l6ZSAtIDYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgTm9kZVR5cGUuYmxvY2s6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LnNhdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQudHJhbnNsYXRlKGVudGl0eS5wb3MueCwgZW50aXR5LnBvcy55KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQucm90YXRlKHRpbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3ByaXRlID0gYmxvY2tzW2VudGl0eS5ibG9jay5zaXplXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQuZHJhd0ltYWdlKHNwcml0ZSwgLXNwcml0ZS53aWR0aCAvIDIsIC1zcHJpdGUuaGVpZ2h0IC8gMik7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LnJlc3RvcmUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIE5vZGVUeXBlLmZpbmlzaDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQuZHJhd0ltYWdlKGZpbmlzaCwgZW50aXR5LnBvcy54IC0gMzIsIGVudGl0eS5wb3MueSAtIDMyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIE5vZGVUeXBlLnN0YXJ0OlxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5kcmF3SW1hZ2Uoc3RhcnQsIGVudGl0eS5wb3MueCAtIDI0LCBlbnRpdHkucG9zLnkgLSAyNCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBOb2RlVHlwZS5lbmQ6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmRyYXdJbWFnZShkcmFnLCBlbnRpdHkucG9zLnggLSAzMiwgZW50aXR5LnBvcy55IC0gMzIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVudGl0eS5yZW5kZXIuaG92ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0Lmdsb2JhbEFscGhhID0gMC44ICsgKDAuMiAqIE1hdGguc2luKHRpbWUgKiA2KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5kcmF3SW1hZ2UocmVzb3VyY2VzLmRyYWdHbG93LCBlbnRpdHkucG9zLnggLSAzMSwgZW50aXR5LnBvcy55IC0gMzEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0Lmdsb2JhbEFscGhhID0gMC4yICsgKDAuMiAqIE1hdGguc2luKHRpbWUgKiAzKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5kcmF3SW1hZ2UocmVzb3VyY2VzLmRyYWdHbG93LCBlbnRpdHkucG9zLnggLSAzMSwgZW50aXR5LnBvcy55IC0gMzEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5nbG9iYWxBbHBoYSA9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbn07XG5cbmNvbnN0IGNyZWF0ZUNhYmxlUmVuZGVyU3lzdGVtID0gKCk6IFJlbmRlclN5c3RlbSA9PiB7XG4gICAgY29uc3QgZW50aXRpZXM6IEVudGl0eVtdID0gW107XG4gICAgcmV0dXJuIHtcbiAgICAgICAgYWRkRW50aXR5OiAoZW50aXR5OiBFbnRpdHkpID0+IHtcbiAgICAgICAgICAgIGlmIChlbnRpdHkuY2FibGUpIHtcbiAgICAgICAgICAgICAgICBlbnRpdGllcy5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlbmRlcjogKGNvbnRleHQ6IENvbnRleHQpID0+IHtcblxuICAgICAgICAgICAgZW50aXRpZXMuZm9yRWFjaChlbnRpdHkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGF0dGFjaG1lbnRzID0gZW50aXR5LmNhYmxlLmF0dGFjaG1lbnRzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXR0YWNobWVudHMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGEgPSBhdHRhY2htZW50c1tpXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYiA9IGF0dGFjaG1lbnRzW2kgKyAxXTtcblxuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LnNhdmUoKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYS5vdmVybGFwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LnNldExpbmVEYXNoKFs1LCAxMF0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChhLmlzb2xhdGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LnN0cm9rZVN0eWxlID0gJyNkMDQ1MzMnO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5saW5lV2lkdGggPSA1O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5zdHJva2VTdHlsZSA9ICd3aGl0ZSc7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmxpbmVXaWR0aCA9IDM7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmxpbmVDYXAgPSAncm91bmQnO1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmJlZ2luUGF0aCgpO1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0Lm1vdmVUbyhhLm91dFBvcyEueCwgYS5vdXRQb3MhLnkpO1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmxpbmVUbyhiLmluUG9zIS54LCBiLmluUG9zIS55KTtcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dC5zdHJva2UoKTtcblxuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LnJlc3RvcmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59O1xuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cImdmeC1nZW5lcmF0b3IudHNcIiAvPlxudHlwZSBTcHJpdGVNYXAgPSB7IFtzaXplOiBudW1iZXJdOiBDYW52YXMgfTtcbnR5cGUgUmVzTG9hZENhbGxzID0gKCkgPT4gdm9pZDtcbnR5cGUgUmVzb3VyY2VzID0ge1xuICAgIGNvaWxzOiBTcHJpdGVNYXA7XG4gICAgYmxvY2tzOiBTcHJpdGVNYXA7XG4gICAgaXNvbGF0b3JzOiBTcHJpdGVNYXA7XG4gICAgbGVkOiBDYW52YXM7XG4gICAgZHJhZzogQ2FudmFzO1xuICAgIGRyYWdHbG93OiBDYW52YXM7XG4gICAgZmluaXNoOiBDYW52YXM7XG4gICAgc3RhcnQ6IENhbnZhcztcbiAgICBncmVlbkdsb3c6IENhbnZhcztcbiAgICByZWRHbG93OiBDYW52YXM7XG4gICAgdHV0b3JpYWwxOiBDYW52YXM7XG4gICAgdHV0b3JpYWwyOiBDYW52YXM7XG59O1xuY29uc3QgZ2VuZXJhdGVSZXNvdXJjZXMgPSAob25Qcm9ncmVzczogKHBlcmNlbnQ6IG51bWJlcikgPT4gdm9pZCwgb25Eb25lOiAocmVzb3VyY2VzOiBSZXNvdXJjZXMpID0+IHZvaWQpID0+IHtcbiAgICBjb25zdCByZXNDYWxsczogUmVzTG9hZENhbGxzW10gPSBbXTtcbiAgICBjb25zdCBjb2lsU3ByaXRlczogU3ByaXRlTWFwID0ge307XG4gICAgY29uc3QgYmxvY2tTcHJpdGVzOiBTcHJpdGVNYXAgPSB7fTtcbiAgICBjb25zdCBpc29sYXRvclNwcml0ZXM6IFNwcml0ZU1hcCA9IHt9O1xuICAgIFszMCwgNDAsIDUwLCA2MCwgNzAsIDgwLCA5MCwgMTAwLCAxMTAsIDEyMCwgMTMwLCAxNDAsIDE1MCwgMTYwXS5mb3JFYWNoKHNpemUgPT4ge1xuICAgICAgICByZXNDYWxscy5wdXNoKCgpID0+IHtcbiAgICAgICAgICAgIGNvaWxTcHJpdGVzW3NpemVdID0gY3JlYXRlQ29pbFNwcml0ZShzaXplICogMiArIDEwKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gICAgWzMwLCA0MCwgNTAsIDYwLCA3MCwgODAsIDkwLCAxMDAsIDExMCwgMTIwLCAxMzAsIDE0MCwgMTUwLCAxNjBdLmZvckVhY2goc2l6ZSA9PiB7XG4gICAgICAgIHJlc0NhbGxzLnB1c2goKCkgPT4ge1xuICAgICAgICAgICAgYmxvY2tTcHJpdGVzW3NpemVdID0gY3JlYXRlQmxvY2tTcHJpdGUoc2l6ZSAqIDIgKyA2KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gICAgWzMwLCA0MCwgNTAsIDYwLCA3MCwgODBdLmZvckVhY2goc2l6ZSA9PiB7XG4gICAgICAgIHJlc0NhbGxzLnB1c2goKCkgPT4ge1xuICAgICAgICAgICAgaXNvbGF0b3JTcHJpdGVzW3NpemVdID0gY3JlYXRlSXNvbGF0b3JTcHJpdGUoc2l6ZSAqIDIgKyAxMCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgY29uc3QgbGVkID0gY3JlYXRlTGVkU3ByaXRlKCk7XG4gICAgY29uc3QgZ3JlZW5HbG93ID0gY3JlYXRlR2xvdyhuZXdDb2woMCwgMSwgMCkpO1xuICAgIGNvbnN0IHJlZEdsb3cgPSBjcmVhdGVHbG93KG5ld0NvbCgxLCAwLCAwKSk7XG4gICAgY29uc3QgZHJhZ1BvaW50ID0gY3JlYXRlQ29ubmVjdG9yQnV0dG9ucyhuZXdDb2woMC4yLCAwLjYsIDAuMiksNzApO1xuICAgIGNvbnN0IHN0YXJ0ID0gY3JlYXRlQ29ubmVjdG9yQnV0dG9ucyhuZXdDb2woMC4yLCAwLjIsIDAuMiksNTIpO1xuICAgIGNvbnN0IGRyYWdHbG93ID0gY3JlYXRlUmluZ0dsb3cobmV3Q29sKDAsIDEsIDApKTtcbiAgICBjb25zdCBmaW5pc2ggPSBjcmVhdGVDb25uZWN0b3JCdXR0b25zKG5ld0NvbCgxLCAwLjQsIDAuNCksNzApO1xuXG4gICAgLy9UdXRvcmlhbCBTY3JlZW5zXG4gICAgY29uc3QgW3R1dG9yaWFsMSwgdHV0Q3R4MV0gPSBjcmVhdGVDYW52YXMoNDUwLCAyNjQpO1xuICAgIHR1dG9yaWFsMS5jbGFzc05hbWUgPSAndHV0b3JpYWwnO1xuICAgIHR1dEN0eDEuZm9udCA9ICcyMHB4IHNhbnMtc2VyaWYnO1xuICAgIHR1dEN0eDEuZmlsbFN0eWxlID0gJyNjY2MnO1xuICAgIHR1dEN0eDEuZmlsbFRleHQoJzEuIERyYWcgdGhlIGNhYmxlIC4uLicsIDIwLCA1MCk7XG4gICAgdHV0Q3R4MS5kcmF3SW1hZ2UoZHJhZ1BvaW50LCAzNTgsIDEwKTtcbiAgICB0dXRDdHgxLmZpbGxUZXh0KCcyLiAuLi5hcm91bmQgdGhlIHBvd2VyIG5vZGVzLi4uJywgMjAsIDE0MCk7XG4gICAgdHV0Q3R4MS5kcmF3SW1hZ2UoY3JlYXRlQ29pbFNwcml0ZSg4MCksIDM1MCwgOTApO1xuICAgIHR1dEN0eDEuZmlsbFRleHQoJzMuIC4uLmFuZCBwbHVnIGl0IGludG8gdGhlIHNvY2tldCEnLCAyMCwgMjMwKTtcbiAgICB0dXRDdHgxLmRyYXdJbWFnZShmaW5pc2gsIDM1OCwgMTkwKTtcblxuICAgIGNvbnN0IFt0dXRvcmlhbDIsIHR1dEN0eDJdID0gY3JlYXRlQ2FudmFzKDQ1MCwgMTAwKTtcbiAgICB0dXRvcmlhbDIuY2xhc3NOYW1lID0gJ3R1dG9yaWFsJztcbiAgICB0dXRDdHgyLmZvbnQgPSAnMjBweCBzYW5zLXNlcmlmJztcbiAgICB0dXRDdHgyLmZpbGxTdHlsZSA9ICcjY2NjJztcbiAgICB0dXRDdHgyLmZpbGxUZXh0KCdJc29sYXRlZCBjYWJsZXMgY2FuIG92ZXJsYXAgb3RoZXJzICcsIDIwLCA1NSk7XG4gICAgdHV0Q3R4Mi5kcmF3SW1hZ2UoY3JlYXRlSXNvbGF0b3JTcHJpdGUoODApLCAzNTgsIDEwKTtcblxuXG4gICAgY29uc3QgbnVtUmVzb3VyY2VzID0gcmVzQ2FsbHMubGVuZ3RoO1xuICAgIGxldCBudW1HZW5lcmF0ZWQgPSAwO1xuICAgIChmdW5jdGlvbiBuZXh0UmVzKCkge1xuICAgICAgICBjb25zdCBuZXh0Q2FsbCA9IHJlc0NhbGxzLnNoaWZ0KCk7XG4gICAgICAgIGlmIChuZXh0Q2FsbCkge1xuICAgICAgICAgICAgbmV4dENhbGwoKTtcbiAgICAgICAgICAgIG9uUHJvZ3Jlc3MoMTAwIC8gbnVtUmVzb3VyY2VzICogKytudW1HZW5lcmF0ZWQpO1xuICAgICAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKG5leHRSZXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb25Eb25lKHtcbiAgICAgICAgICAgICAgICBjb2lsczogY29pbFNwcml0ZXMsXG4gICAgICAgICAgICAgICAgYmxvY2tzOiBibG9ja1Nwcml0ZXMsXG4gICAgICAgICAgICAgICAgaXNvbGF0b3JzOiBpc29sYXRvclNwcml0ZXMsXG4gICAgICAgICAgICAgICAgZ3JlZW5HbG93LFxuICAgICAgICAgICAgICAgIHJlZEdsb3csXG4gICAgICAgICAgICAgICAgbGVkLFxuICAgICAgICAgICAgICAgIGRyYWc6IGRyYWdQb2ludCxcbiAgICAgICAgICAgICAgICBkcmFnR2xvdyxcbiAgICAgICAgICAgICAgICBmaW5pc2gsXG4gICAgICAgICAgICAgICAgdHV0b3JpYWwxLFxuICAgICAgICAgICAgICAgIHR1dG9yaWFsMixcbiAgICAgICAgICAgICAgICBzdGFydFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KSgpO1xuXG59O1xuIiwidHlwZSBTeXN0ZW0gPSB7XG4gICAgYWRkRW50aXR5OiAoZW50aXR5OiBFbnRpdHkpID0+IHZvaWQ7XG4gICAgdXBkYXRlPzogKHRpbWU6IG51bWJlcikgPT4gdm9pZDtcbiAgICBzaHV0ZG93bj86ICgpID0+IHZvaWQ7XG59O1xudHlwZSBSZW5kZXJTeXN0ZW0gPSBTeXN0ZW0gJiB7IHJlbmRlcjogKGNvbnRleHQ6IENvbnRleHQsIHRpbWU6IG51bWJlcikgPT4gdm9pZCB9XG50eXBlIFVwZGF0ZVN5c3RlbSA9IFN5c3RlbSAmIHsgdXBkYXRlOiAodGltZTogbnVtYmVyKSA9PiB2b2lkIH1cblxuaW50ZXJmYWNlIFNwYWNlIHtcbiAgICBlbnRpdGllczogUGFydGlhbDxFbnRpdHk+W107XG5cbiAgICByZWdpc3RlclN5c3RlbShzeXN0ZW06IFN5c3RlbSk6IHZvaWQ7XG5cbiAgICBhZGRFbnRpdHkoZW50aXR5OiBQYXJ0aWFsPEVudGl0eT4pOiB2b2lkO1xuXG4gICAgc2h1dGRvd24oKTogdm9pZDtcbn1cblxuY29uc3QgY3JlYXRlU3BhY2UgPSAoKTogU3BhY2UgPT4ge1xuICAgIGNvbnN0IHN5c3RlbXM6IFN5c3RlbVtdID0gW107XG4gICAgY29uc3QgZW50aXRpZXM6IFBhcnRpYWw8RW50aXR5PltdID0gW107XG5cbiAgICByZXR1cm4ge1xuICAgICAgICByZWdpc3RlclN5c3RlbTogKHN5c3RlbTogU3lzdGVtKSA9PiB7XG4gICAgICAgICAgICBzeXN0ZW1zLnB1c2goc3lzdGVtKTtcbiAgICAgICAgfSxcbiAgICAgICAgYWRkRW50aXR5OiAoZW50aXR5OiBQYXJ0aWFsPEVudGl0eT4pID0+IHtcbiAgICAgICAgICAgIGVudGl0aWVzLnB1c2goZW50aXR5KTtcbiAgICAgICAgICAgIHN5c3RlbXMuZm9yRWFjaChzeXN0ZW0gPT4ge1xuICAgICAgICAgICAgICAgIHN5c3RlbS5hZGRFbnRpdHkoZW50aXR5IGFzIEVudGl0eSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgc2h1dGRvd246KCk9PiB7XG4gICAgICAgICAgICBzeXN0ZW1zLmZvckVhY2goc3lzdGVtID0+IHN5c3RlbS5zaHV0ZG93biAmJiBzeXN0ZW0uc2h1dGRvd24oKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVudGl0aWVzXG4gICAgfTtcbn07XG4iLCJjb25zdCBjYWxjdWxhdGVUYW5nZW50cyA9IGZ1bmN0aW9uIChhdHRhY2htZW50czogQXR0YWNobWVudFtdKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhdHRhY2htZW50cy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgY29uc3QgYSA9IGF0dGFjaG1lbnRzW2ldO1xuICAgICAgICBjb25zdCBiID0gYXR0YWNobWVudHNbaSArIDFdO1xuICAgICAgICBjb25zdCB0YW5nZW50cyA9IGdldFRhbmdlbnRzKGEuZW50aXR5LnBvcywgYS5lbnRpdHkuc3Bvb2wuc2l6ZSwgYi5lbnRpdHkucG9zLCBiLmVudGl0eS5zcG9vbC5zaXplKTtcbiAgICAgICAgY29uc3QgaWR4ID0gYS5zaWRlID09IFNpZGUubGVmdCA/IGIuc2lkZSA9PSBTaWRlLmxlZnQgPyAxIDogMyA6IGIuc2lkZSA9PSBTaWRlLmxlZnQgPyAyIDogMDtcblxuICAgICAgICBpZiAoIXRhbmdlbnRzW2lkeF0pIHtcblxuICAgICAgICB9XG4gICAgICAgIGEub3V0UG9zID0gdGFuZ2VudHNbaWR4XVswXTtcbiAgICAgICAgYi5pblBvcyA9IHRhbmdlbnRzW2lkeF1bMV07XG4gICAgfVxufTtcblxuY29uc3QgZ2V0SW50ZXJzZWN0aW9ucyA9IChhOiBWZWMyLCBiOiBWZWMyLCBzcG9vbEVudGl0aWVzOiBTcG9vbEVudGl0eVtdLCBpZ25vcmVBOiBTcG9vbEVudGl0eSwgaWdub3JlQjogU3Bvb2xFbnRpdHkpOiBTcG9vbEVudGl0eVtdID0+IHtcbiAgICByZXR1cm4gc3Bvb2xFbnRpdGllc1xuICAgICAgICAuZmlsdGVyKHNwb29sRW50aXR5ID0+XG4gICAgICAgICAgICAoc3Bvb2xFbnRpdHkgIT0gaWdub3JlQSAmJiBzcG9vbEVudGl0eSAhPSBpZ25vcmVCKSAmJlxuICAgICAgICAgICAgbGluZUNpcmNsZUludGVyc2VjdChhLCBiLCBzcG9vbEVudGl0eS5wb3MsIHNwb29sRW50aXR5LnNwb29sLnNpemUpXG4gICAgICAgIClcbiAgICAgICAgLnNvcnQoKGNhLCBjYikgPT4gZGlzdDIoY2EucG9zLCBhKSA+IGRpc3QyKGNiLnBvcywgYSkgPyAxIDogLTEpOyAvL1RPRE86IG5lZWQgdG8gYWRkIHRoZSByYWRpdXNcbn07XG5cbmNvbnN0IHJlc29sdmVDb25uZWN0aW9ucyA9IGZ1bmN0aW9uIChhdHRhY2htZW50czogQXR0YWNobWVudFtdLCBzcG9vbHM6IFNwb29sRW50aXR5W10pIHtcbiAgICBsZXQgcmVzb2x2ZWQ6IGJvb2xlYW47XG4gICAgZG8ge1xuICAgICAgICByZXNvbHZlZCA9IHRydWU7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXR0YWNobWVudHMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBhID0gYXR0YWNobWVudHNbaV07XG4gICAgICAgICAgICBjb25zdCBiID0gYXR0YWNobWVudHNbaSArIDFdO1xuICAgICAgICAgICAgY29uc3QgZW50aXR5ID0gZ2V0SW50ZXJzZWN0aW9ucyhhLm91dFBvcyEsIGIuaW5Qb3MhLCBzcG9vbHMsIGEuZW50aXR5LCBiLmVudGl0eSlbMF07XG4gICAgICAgICAgICBpZiAoZW50aXR5ICkge1xuICAgICAgICAgICAgICAgIGlmIChlbnRpdHkuc3Bvb2wuaXNBdHRhY2hlZCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBub2RlIGFscmVhZHkgY29ubmVjdGVkXG4gICAgICAgICAgICAgICAgICAgIGEub3ZlcmxhcCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gd2UgaGF2ZSBhIGNvbm5lY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LnNwb29sLmlzQXR0YWNoZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaWRlID0gc2lkZU9mTGluZShhLm91dFBvcyEsIGIuaW5Qb3MhLCBlbnRpdHkucG9zKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXR0YWNobWVudDogQXR0YWNobWVudCA9IHtlbnRpdHk6IGVudGl0eSwgc2lkZX07XG4gICAgICAgICAgICAgICAgICAgIGF0dGFjaG1lbnRzLnNwbGljZShpICsgMSwgMCwgYXR0YWNobWVudCk7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGNhbGN1bGF0ZVRhbmdlbnRzKFthLCBhdHRhY2htZW50LCBiXSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gd2hpbGUgKCFyZXNvbHZlZCk7XG59O1xuXG5jb25zdCByZXNvbHZlRGlzY29ubmVjdGlvbnMgPSBmdW5jdGlvbiAoYXR0YWNobWVudHM6IEF0dGFjaG1lbnRbXSkge1xuICAgIGxldCByZXNvbHZlZDogYm9vbGVhbjtcbiAgICBkbyB7XG4gICAgICAgIHJlc29sdmVkID0gdHJ1ZTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCBhdHRhY2htZW50cy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGEgPSBhdHRhY2htZW50c1tpIC0gMV07XG4gICAgICAgICAgICBjb25zdCBiID0gYXR0YWNobWVudHNbaV07XG4gICAgICAgICAgICBjb25zdCBjID0gYXR0YWNobWVudHNbaSArIDFdO1xuXG4gICAgICAgICAgICBjb25zdCB2QUIgPSBzdWJWKGEub3V0UG9zISwgYi5pblBvcyEpO1xuICAgICAgICAgICAgY29uc3QgdkJDID0gc3ViVihiLm91dFBvcyEsIGMuaW5Qb3MhKTtcbiAgICAgICAgICAgIGxldCBhbmdsZSA9IE1hdGguYXRhbjIodkJDLnksIHZCQy54KSAtIE1hdGguYXRhbjIodkFCLnksIHZBQi54KTtcbiAgICAgICAgICAgIGlmIChhbmdsZSA8IDApIGFuZ2xlICs9IDIgKiBNYXRoLlBJO1xuICAgICAgICAgICAgaWYgKChiLnNpZGUgPT0gU2lkZS5sZWZ0ICYmIGFuZ2xlID4gTWF0aC5QSSAqIDEuOCkgfHxcbiAgICAgICAgICAgICAgICAoYi5zaWRlID09IFNpZGUucmlnaHQgJiYgYW5nbGUgPCBNYXRoLlBJICogMC4yKSkge1xuICAgICAgICAgICAgICAgIGF0dGFjaG1lbnRzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICBiLmVudGl0eS5zcG9vbC5pc0F0dGFjaGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBjYWxjdWxhdGVUYW5nZW50cyhbYSwgY10pO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSB3aGlsZSAoIXJlc29sdmVkKTtcbn07XG5cbmNvbnN0IGNyZWF0ZVNwb29sU3lzdGVtID0gKG9uTGV2ZWxDb21wbGV0ZWQ6ICgpID0+IHZvaWQpOiBVcGRhdGVTeXN0ZW0gPT4ge1xuICAgIGNvbnN0IHNwb29sRW50aXRpZXM6IFNwb29sRW50aXR5W10gPSBbXTtcbiAgICBjb25zdCBibG9ja0VudGl0aWVzOiBCbG9ja0VudGl0eVtdID0gW107XG4gICAgY29uc3QgY2FibGVzOiBDYWJsZUVudGl0eVtdID0gW107XG4gICAgbGV0IGZpbmlzaEVudGl0eTogRmluaXNoRW50aXR5O1xuICAgIGxldCBsYXN0UG93ZXJlZFNwb29scyA9MDtcbiAgICBsZXQgbnVtU3Bvb2xzID0gMDtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGFkZEVudGl0eTogKGVudGl0eTogRW50aXR5KSA9PiB7XG4gICAgICAgICAgICBpZiAoZW50aXR5LnNwb29sKSB7XG4gICAgICAgICAgICAgICAgc3Bvb2xFbnRpdGllcy5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICAgICAgaWYgKGVudGl0eS5zcG9vbC50eXBlID09IE5vZGVUeXBlLnNwb29sKSB7XG4gICAgICAgICAgICAgICAgICAgIG51bVNwb29scysrO1xuICAgICAgICAgICAgICAgICAgICBub2RlSW5mby5pbm5lckhUTUwgPSAwICsgJyAvICcgKyBudW1TcG9vbHM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGVudGl0eS5jYWJsZSkge1xuICAgICAgICAgICAgICAgIGNhYmxlcy5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZW50aXR5LmJsb2NrKSB7XG4gICAgICAgICAgICAgICAgYmxvY2tFbnRpdGllcy5wdXNoKGVudGl0eSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZW50aXR5LmZpbmlzaCkge1xuICAgICAgICAgICAgICAgIGZpbmlzaEVudGl0eSA9IGVudGl0eTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgdXBkYXRlOiAodGltZTogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBjYWJsZXMuZm9yRWFjaChjYWJsZSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXR0YWNobWVudHMgPSBjYWJsZS5jYWJsZS5hdHRhY2htZW50cztcblxuICAgICAgICAgICAgICAgIC8vIHJlc2V0IHN0YXRlc1xuICAgICAgICAgICAgICAgIGNhYmxlLmNhYmxlLm92ZXJwb3dlcmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgYXR0YWNobWVudHMuZm9yRWFjaChhdHRhY2htZW50ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgYXR0YWNobWVudC5vdmVybGFwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgc3Bvb2xFbnRpdGllcy5mb3JFYWNoKHNwb29sID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc3Bvb2wuc3Bvb2wucG93ZXJlZCA9IHNwb29sLnNwb29sLm92ZXJwb3dlcmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgbGV0IG51bVBvd2VyZWRTcG9vbHMgPSAwO1xuXG5cbiAgICAgICAgICAgICAgICBjYWxjdWxhdGVUYW5nZW50cyhhdHRhY2htZW50cyk7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZUNvbm5lY3Rpb25zKGF0dGFjaG1lbnRzLCBzcG9vbEVudGl0aWVzKTtcbiAgICAgICAgICAgICAgICByZXNvbHZlRGlzY29ubmVjdGlvbnMoYXR0YWNobWVudHMpO1xuXG4gICAgICAgICAgICAgICAgLy8gc2V0IGlzb2xhdGVkIHN0YXR1c1xuICAgICAgICAgICAgICAgIGxldCBpc0lzb2xhdGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgY2FibGUuY2FibGUuYXR0YWNobWVudHMuZm9yRWFjaChhdHRhY2htZW50ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3Bvb2wgPSBhdHRhY2htZW50LmVudGl0eS5zcG9vbDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNwb29sLnR5cGUgPT0gTm9kZVR5cGUuaXNvbGF0b3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzSXNvbGF0ZWQgPSAhaXNJc29sYXRlZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBhdHRhY2htZW50Lmlzb2xhdGVkID0gaXNJc29sYXRlZDtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGxpbmUgb3ZlcmxhcFxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXR0YWNobWVudHMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGExID0gYXR0YWNobWVudHNbaV07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGIxID0gYXR0YWNobWVudHNbaSArIDFdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYTEuaXNvbGF0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgYXR0YWNobWVudHMubGVuZ3RoIC0gMTsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhMiA9IGF0dGFjaG1lbnRzW2pdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYjIgPSBhdHRhY2htZW50c1tqICsgMV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYTIuaXNvbGF0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaW5lTGluZUludGVyc2VjdChhMS5vdXRQb3MhLCBiMS5pblBvcyEsIGEyLm91dFBvcyEsIGIyLmluUG9zISkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhMS5vdmVybGFwID0gYTIub3ZlcmxhcCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBjaGVjayBibG9jayBjb2xsaXNpb25cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGF0dGFjaG1lbnRzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhMSA9IGF0dGFjaG1lbnRzW2ldO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBiMSA9IGF0dGFjaG1lbnRzW2kgKyAxXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBibG9ja0VudGl0aWVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGluZUNpcmNsZUludGVyc2VjdChhMS5vdXRQb3MhLCBiMS5pblBvcyEsIGJsb2NrRW50aXRpZXNbal0ucG9zLCBibG9ja0VudGl0aWVzW2pdLmJsb2NrLnNpemUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYTEub3ZlcmxhcCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FibGUuY2FibGUub3ZlcnBvd2VyZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIGNoZWNrIHBvd2VyIC8gb3ZlcnBvd2VyXG4gICAgICAgICAgICAgICAgbGV0IGhhc1Bvd2VyID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjYWJsZS5jYWJsZS5hdHRhY2htZW50cy5ldmVyeShhdHRhY2htZW50ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFoYXNQb3dlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChhdHRhY2htZW50Lmlzb2xhdGVkICYmICFhdHRhY2htZW50Lm92ZXJsYXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChhdHRhY2htZW50LmVudGl0eS5zcG9vbC5wb3dlcmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRhY2htZW50LmVudGl0eS5zcG9vbC5vdmVycG93ZXJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWJsZS5jYWJsZS5vdmVycG93ZXJlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBhdHRhY2htZW50LmVudGl0eS5zcG9vbC5wb3dlcmVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoYXR0YWNobWVudC5vdmVybGFwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGhhc1Bvd2VyID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYXR0YWNobWVudC5lbnRpdHkuc3Bvb2wudHlwZSA9PSBOb2RlVHlwZS5zcG9vbCl7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIG51bVBvd2VyZWRTcG9vbHMrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGlmIGxldmVsIGlzIGNvbXBsZXRlZFxuICAgICAgICAgICAgICAgIGlmIChoYXNQb3dlciAmJiBmaW5pc2hFbnRpdHkuZmluaXNoLmNvbm5lY3RlZCAmJiAhY2FibGUuY2FibGUub3ZlcnBvd2VyZWQgJiYgbnVtUG93ZXJlZFNwb29scyA9PT0gbnVtU3Bvb2xzKSB7XG4gICAgICAgICAgICAgICAgICAgIG9uTGV2ZWxDb21wbGV0ZWQoKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobnVtUG93ZXJlZFNwb29scyAhPSBsYXN0UG93ZXJlZFNwb29scykge1xuICAgICAgICAgICAgICAgICAgICBub2RlSW5mby5pbm5lckhUTUwgPSBudW1Qb3dlcmVkU3Bvb2xzICsgJyAvICcgKyBudW1TcG9vbHM7XG4gICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgICAgICBsYXN0UG93ZXJlZFNwb29scyA9IG51bVBvd2VyZWRTcG9vbHM7XG5cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcbn07XG4iLCJ0eXBlIENhbnZhcyA9IEhUTUxDYW52YXNFbGVtZW50O1xudHlwZSBDb250ZXh0ID0gQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEO1xudHlwZSBGaWxsU3R5bGUgPSBzdHJpbmcgfCBDYW52YXNHcmFkaWVudCB8IENhbnZhc1BhdHRlcm47XG50eXBlIFN0cm9rZVN0eWxlID0gc3RyaW5nIHwgQ2FudmFzR3JhZGllbnQgfCBDYW52YXNQYXR0ZXJuXG5cbmVudW0gU2lkZSB7bGVmdCA9IC0xLCByaWdodCA9IDF9XG5cbmVudW0gTm9kZVR5cGUge1xuICAgIHNwb29sLCBzdGFydCwgZW5kLCBibG9jaywgZmluaXNoLCBpc29sYXRvclxufVxuXG5pbnRlcmZhY2UgR2FtZU9iamVjdCB7XG5cbn1cblxudHlwZSBDb2xvciA9IHsgcjogbnVtYmVyLCBnOiBudW1iZXIsIGI6IG51bWJlciwgYTogbnVtYmVyIH1cblxuaW50ZXJmYWNlIENvbm5lY3RvciB7XG4gICAgcG9zOiBWZWMyO1xuICAgIHNpemU6IG51bWJlcjtcbn1cblxudHlwZSBBY3RpdmF0YWJsZSA9IENvbm5lY3RvciAmIHtcbiAgICBhY3RpdmU/OiBib29sZWFuO1xufVxuXG50eXBlIEhhc1Bvc2l0aW9uID0geyBwb3M6IFZlYzI7IH1cblxudHlwZSBTcG9vbCA9IEhhc1Bvc2l0aW9uICYgeyBzaXplOiBudW1iZXI7IH1cbi8vIGludGVyZmFjZSBTcG9vbCBleHRlbmRzICBDb25uZWN0b3Ige1xuLy8gICAgIGhvdmVyPzogYm9vbGVhbjtcbi8vIH1cblxudHlwZSBWZWMyID0ge1xuICAgIHg6IG51bWJlcjtcbiAgICB5OiBudW1iZXI7XG59O1xuXG50eXBlIFBvc2l0aW9uQ29tcG9uZW50ID0ge1xuICAgIHBvczogVmVjMjtcbn1cblxudHlwZSBTcG9vbENvbXBvbmVudCA9IHtcbiAgICB0eXBlOiBOb2RlVHlwZTtcbiAgICBzaXplOiBudW1iZXI7XG4gICAgaXNBdHRhY2hlZD86Ym9vbGVhbjtcbiAgICBwb3dlcmVkPzogYm9vbGVhbjtcbiAgICBvdmVycG93ZXJlZD86IGJvb2xlYW47XG59XG5cbnR5cGUgQmxvY2tDb21wb25lbnQgPSB7XG4gICAgc2l6ZTogbnVtYmVyO1xufVxudHlwZSBJc29sYXRvckNvbXBvbmVudCA9IHtcbiAgICBzaXplOiBudW1iZXI7XG59XG5cbnR5cGUgUmVuZGVyQ29tcG9uZW50ID0ge1xuICAgIHR5cGU6IE5vZGVUeXBlXG4gICAgaG92ZXI/OiBib29sZWFuXG59XG50eXBlIElucHV0Q29tcG9uZW50ID0ge1xuICAgIGlucHV0U2l6ZTogbnVtYmVyXG59XG50eXBlIEF0dGFjaG1lbnQgPSB7IGVudGl0eTogU3Bvb2xFbnRpdHksIHNpZGU6IFNpZGU7IGluUG9zPzogVmVjMiwgb3V0UG9zPzogVmVjMiwgaXNvbGF0ZWQ/OmJvb2xlYW4sIG92ZXJsYXA/OmJvb2xlYW4gfVxudHlwZSBNb3VzZURyYWdDb21wb25lbnQgPSB7IHNpemU6IG51bWJlciB9O1xudHlwZSBDYWJsZUNvbXBvbmVudCA9IHtcbiAgICBhdHRhY2htZW50czogQXR0YWNobWVudFtdO1xuICAgIG92ZXJwb3dlcmVkPzogYm9vbGVhbjtcbn1cblxudHlwZSBGaW5pc2hDb21wb25lbnQgPSB7IGNvbm5lY3RlZD86IGJvb2xlYW4gfTtcbnR5cGUgRW50aXR5ID0ge1xuICAgIHBvczogVmVjMjtcbiAgICBzcG9vbDogU3Bvb2xDb21wb25lbnQ7XG4gICAgYmxvY2s6IEJsb2NrQ29tcG9uZW50O1xuICAgIGlucHV0OiBJbnB1dENvbXBvbmVudDtcbiAgICByZW5kZXI6IFJlbmRlckNvbXBvbmVudDtcbiAgICBpc29sYXRvcjogSXNvbGF0b3JDb21wb25lbnQ7XG4gICAgY2FibGU6IENhYmxlQ29tcG9uZW50O1xuICAgIG1vdXNlRHJhZzogTW91c2VEcmFnQ29tcG9uZW50O1xuICAgIGZpbmlzaDogRmluaXNoQ29tcG9uZW50O1xuICAgIC8vIHN0YXJ0Tm9kZT86IEVuZE5vZGU7XG4gICAgLy8gRW5kTm9kZU5vZGU/OiBFbmROb2RlO1xufVxuXG50eXBlIFNwb29sRW50aXR5ID0gUGljazxFbnRpdHksICdwb3MnIHwgJ3Nwb29sJz47XG50eXBlIFNwb29sTm9kZUVudGl0eSA9IFBpY2s8RW50aXR5LCAncmVuZGVyJz4gJiBTcG9vbEVudGl0eTtcbnR5cGUgU3RhcnROb2RlRW50aXR5ID0gUGljazxFbnRpdHksICdwb3MnIHwgJ3Nwb29sJyB8ICdyZW5kZXInPjtcbnR5cGUgRW5kTm9kZUVudGl0eSA9IFBpY2s8RW50aXR5LCAncG9zJyB8ICdzcG9vbCcgfCAncmVuZGVyJyB8ICdtb3VzZURyYWcnPjtcbnR5cGUgQ2FibGVFbnRpdHkgPSBQaWNrPEVudGl0eSwgJ2NhYmxlJz47XG50eXBlIFJlbmRlckVudGl0eSA9IFBpY2s8RW50aXR5LCAncmVuZGVyJz47XG50eXBlIE1vdXNlRHJhZ0VudGl0eSA9IFBpY2s8RW50aXR5LCAnbW91c2VEcmFnJyB8ICdwb3MnPjtcbnR5cGUgRmluaXNoRW50aXR5ID0gUGljazxFbnRpdHksICdmaW5pc2gnIHwgJ3JlbmRlcicgfCAncG9zJz47XG50eXBlIEJsb2NrRW50aXR5ID0gUGljazxFbnRpdHksICdibG9jaycgfCAncG9zJz47XG50eXBlIEJsb2NrTm9kZUVudGl0eSA9IFBpY2s8RW50aXR5LCAncmVuZGVyJz4gJiBCbG9ja0VudGl0eTtcbnR5cGUgSXNvbGF0b3JFbnRpdHkgPSBQaWNrPEVudGl0eSwgJ3BvcycgfCAncmVuZGVyJyB8ICdpc29sYXRvcicgPjtcblxuLy8gVE9ETzogZG8gaSBuZWVkIHRvIGRpZmZlcmVudGlhdGUgYmV0d2VlbiBOb2RlRW50aXR5IGFuZCBFbnRpdHk/ISBkb24ndCB0aGluayBzbywgcmVtb3ZlIE5vZGVFbnRpdHlcblxuLypcbiAgICBTdGFydFxuICAgICAgICBIYXNQb3NpdGlvblxuICAgICAgICBTdGFydE5vZGVcbiAgICAgICAgU3Bvb2xcbiAgICBFbmRcbiAgICAgICAgSGFzUG9zaXRpb25cbiAgICAgICAgU3Bvb2xcbiAgICAgICAgTW91c2VFdmVudHNcbiAgICAgICAgRHJhZ0Nvbm5lY3RvclxuICAgICBGaW5pc2hcbiAgICAgICAgSGFzUG9zaXRpb25cbiAgICAgICAgRmluaXNoTm9kZVxuICAgICBTcG9vbFxuICAgICAgICBIYXNQb3NpdGlvblxuICAgICAgICBTcG9vbFxuXG5cblxuICovXG5cbiIsImNvbnN0IG5leHRGcmFtZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZTtcbmNvbnN0IHN0YXJ0RnJhbWVMb29wID0gKGNhbGxiYWNrOiAodGltZTogbnVtYmVyKSA9PiB2b2lkICkgPT4ge1xuXG4gICAgbGV0IHJlcXVlc3RJZDogbnVtYmVyO1xuICAgIGxldCBzdG9wTG9vcDpib29sZWFuID0gZmFsc2U7XG4gICAgbGV0IGxhc3RUaW1lID0gMDtcbiAgICBjb25zdCB1cGRhdGUgPSAodGltZTogbnVtYmVyKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKHRpbWUgKiAwLjAwMSk7XG4gICAgICAgIGlmICghc3RvcExvb3ApIHtcbiAgICAgICAgICAgIHJlcXVlc3RJZCA9IG5leHRGcmFtZSh1cGRhdGUpO1xuICAgICAgICB9XG4gICAgICAgIGxhc3RUaW1lID0gdGltZTtcbiAgICB9O1xuICAgIHJlcXVlc3RJZD0gbmV4dEZyYW1lKHVwZGF0ZSk7XG5cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICBzdG9wTG9vcCA9IHRydWU7XG4gICAgfTtcbn07XG5cbmNvbnN0IHR3ZWVuID0gKGZyb206IG51bWJlciwgdG86IG51bWJlciwgZHVyYXRpb246bnVtYmVyLCBvblVwZGF0ZTogKHQ6IG51bWJlcikgPT4gdm9pZCwgb25Db21wbGV0ZTogKCkgPT4gdm9pZCkgPT4ge1xuICAgIGNvbnN0IHN0YXJ0VGltZSA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIGNvbnN0IHVwZGF0ZSA9ICh0aW1lOiBudW1iZXIpID0+IHtcbiAgICAgICAgbGV0IHQgPSAxL2R1cmF0aW9uICogKHRpbWUtc3RhcnRUaW1lKSowLjAwMTtcbiAgICAgICAgaWYgKHQgPCAxKSB7XG4gICAgICAgICAgICBvblVwZGF0ZShmcm9tKyh0by1mcm9tKSp0KTtcbiAgICAgICAgICAgIG5leHRGcmFtZSh1cGRhdGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb25VcGRhdGUodG8pO1xuICAgICAgICAgICAgbmV4dEZyYW1lKG9uQ29tcGxldGUpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICB1cGRhdGUoc3RhcnRUaW1lKTtcbn07XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwidHlwZXMudHNcIiAvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cInV0aWxzXCIgLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJtYXRoLXV0aWwudHNcIiAvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cImh0bWwudHNcIiAvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cInJlc291cmNlcy50c1wiIC8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiZ2FtZS50c1wiIC8+XG5cbmNvbnN0IHNob3dFbmRTY3JlZW4gPSAoKSA9PiB7XG4gICAgbmV4dE1zZy5pbm5lckhUTUwgPSAnVGhhbmtzIGZvciBwbGF5aW5nISc7XG4gICAgbmV4dEJ0bi5pbm5lckhUTUwgPSAnQUdBSU4nO1xuICAgIHNob3dFbGVtZW50KGxldmVsRG9uZUVsZW1lbnQsICgpID0+IHtcbiAgICAgICAgbmV4dEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4ge1xuICAgICAgICAgICAgbG9jYXRpb24ucmVsb2FkKCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICAgIHNhdmVMZXZlbCgwKTtcbn07XG5cbmNvbnN0IHN0YXJ0R2FtZSA9IChwYXJlbnQ6IEhUTUxFbGVtZW50LCByZXNvdXJjZXM6IFJlc291cmNlcywgc3RhcnRMZXZlbDogbnVtYmVyKSA9PiB7XG4gICAgY29uc3QgZ2FtZSA9IGNyZWF0ZUdhbWUoKTtcbiAgICBsZXQgY3VycmVudExldmVsID0gc3RhcnRMZXZlbDtcblxuICAgIGNvbnN0IHN0YXJ0TmV4dExldmVsID0gKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnc3RhcnQgbGV2ZWwgJyArIGN1cnJlbnRMZXZlbCk7XG5cbiAgICAgICAgbGV0IHR1dG9yaWFsOiBIVE1MRWxlbWVudDtcbiAgICAgICAgaWYgKGN1cnJlbnRMZXZlbCA9PSAwKSB7XG4gICAgICAgICAgICB0dXRvcmlhbCA9IHJlc291cmNlcy50dXRvcmlhbDE7XG4gICAgICAgICAgICBnYW1lRWxlbWVudC5hcHBlbmRDaGlsZCh0dXRvcmlhbCk7XG4gICAgICAgICAgICBzaG93RWxlbWVudCh0dXRvcmlhbCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN1cnJlbnRMZXZlbCA9PSAyKSB7XG4gICAgICAgICAgICB0dXRvcmlhbCA9IHJlc291cmNlcy50dXRvcmlhbDI7XG4gICAgICAgICAgICBnYW1lRWxlbWVudC5hcHBlbmRDaGlsZCh0dXRvcmlhbCk7XG4gICAgICAgICAgICBzaG93RWxlbWVudCh0dXRvcmlhbCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBsZXZlbCA9IGdhbWUuY3JlYXRlTGV2ZWwoZ2FtZURhdGEubGV2ZWxzW2N1cnJlbnRMZXZlbF0sIHJlc291cmNlcywgKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHR1dG9yaWFsKSB7XG4gICAgICAgICAgICAgICAgaGlkZUVsZW1lbnQodHV0b3JpYWwsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlRWxlbWVudCh0dXRvcmlhbCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY3VycmVudExldmVsIDwgZ2FtZURhdGEubGV2ZWxzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50TGV2ZWwrKztcbiAgICAgICAgICAgICAgICBzYXZlTGV2ZWwoY3VycmVudExldmVsKTtcbiAgICAgICAgICAgICAgICBoaWRlRWxlbWVudChyZXNldEVsZW1lbnQpO1xuICAgICAgICAgICAgICAgIHNob3dFbGVtZW50KFtsZXZlbERvbmVFbGVtZW50XSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBuZXh0QnRuLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXh0QnRuLm9uY2xpY2sgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgaGlkZUVsZW1lbnQoW2xldmVsRG9uZUVsZW1lbnQsIGxldmVsLmNhbnZhcywgbGV2ZWxJbmZvLCBub2RlSW5mb10sICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVFbGVtZW50KGxldmVsLmNhbnZhcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnROZXh0TGV2ZWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNob3dFbmRTY3JlZW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcGFyZW50LmFwcGVuZENoaWxkKGxldmVsLmNhbnZhcyk7XG4gICAgICAgIGxldmVsSW5mby5pbm5lckhUTUwgPSAnTGV2ZWwgJyArIChjdXJyZW50TGV2ZWwgKyAxKTtcbiAgICAgICAgc2hvd0VsZW1lbnQoW2xldmVsLmNhbnZhcywgcmVzZXRFbGVtZW50LCBsZXZlbEluZm8sIG5vZGVJbmZvXSk7XG5cbiAgICAgICAgY29uc3QgcmVzZXRMZXZlbCA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh0dXRvcmlhbCkge1xuICAgICAgICAgICAgICAgIGhpZGVFbGVtZW50KHR1dG9yaWFsLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZUVsZW1lbnQodHV0b3JpYWwpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYmFja0J0bi5vbmNsaWNrID0gc2tpcEJ0bi5vbmNsaWNrID0gcmVzZXRCdG4ub25jbGljayA9IG51bGw7XG4gICAgICAgICAgICBoaWRlRWxlbWVudChbbGV2ZWwuY2FudmFzLCByZXNldEVsZW1lbnQsIGxldmVsSW5mbywgbm9kZUluZm9dLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgbGV2ZWwuc2h1dGRvd24oKTtcbiAgICAgICAgICAgICAgICByZW1vdmVFbGVtZW50KGxldmVsLmNhbnZhcyk7XG4gICAgICAgICAgICAgICAgc3RhcnROZXh0TGV2ZWwoKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH07XG5cbiAgICAgICAgcmVzZXRCdG4ub25jbGljayA9IHJlc2V0TGV2ZWw7XG4gICAgICAgIHNraXBCdG4ub25jbGljayA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50TGV2ZWwgPiBnYW1lRGF0YS5sZXZlbHMubGVuZ3RoIC0gMikge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGN1cnJlbnRMZXZlbCsrO1xuICAgICAgICAgICAgcmVzZXRMZXZlbCgpO1xuICAgICAgICB9O1xuICAgICAgICBiYWNrQnRuLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoY3VycmVudExldmVsIDwgMSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGN1cnJlbnRMZXZlbC0tO1xuICAgICAgICAgICAgcmVzZXRMZXZlbCgpO1xuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBzdGFydE5leHRMZXZlbCgpO1xufTtcblxuY29uc3QgcHJlcGFyZUdhbWUgPSAoKSA9PiB7XG4gICAgY29uc3QgW2xvYWRpbmdCYXIsIGNvbnRleHRdID0gY3JlYXRlQ2FudmFzKDIwMCwgNyk7XG4gICAgbG9hZGluZ0Jhci5pZCA9ICdsb2FkaW5nYmFyJztcbiAgICBsb2FkaW5nRWxlbWVudC5hcHBlbmRDaGlsZChsb2FkaW5nQmFyKTtcbiAgICBzaG93RWxlbWVudChsb2FkaW5nQmFyKTtcbiAgICBjb250ZXh0LnN0cm9rZVN0eWxlID0gJ2dyZXknO1xuICAgIGNvbnRleHQuZmlsbFN0eWxlID0gJ2dyZXknO1xuICAgIGNvbnRleHQubGluZVdpZHRoID0gMTtcblxuICAgIGNvbnRleHQuc3Ryb2tlUmVjdCgwLjUsIDAuNSwgMTk5LCA0KTtcbiAgICBnZW5lcmF0ZVJlc291cmNlcyhwID0+IHtcbiAgICAgICAgY29udGV4dC5maWxsUmVjdCgwLjUsIDAuNSwgMTk5IC8gMTAwICogcCwgNCk7XG4gICAgfSwgKHJlc291cmNlcykgPT4ge1xuXG4gICAgICAgIGhpZGVFbGVtZW50KGxvYWRpbmdCYXIsICgpID0+IHtcbiAgICAgICAgICAgIHNob3dFbGVtZW50KFttZW51RWxlbWVudCwgZGVzY3JpcHRpb25FbGVtZW50XSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHNhdmVkTGV2ZWwgPSBsb2FkTGV2ZWwoKTtcbiAgICAgICAgICAgIGNvbnRpbnVlQnRuLnN0eWxlLnZpc2liaWxpdHkgPSBzYXZlZExldmVsID8gJ3Zpc2libGUnIDogJ2hpZGRlbic7XG5cbiAgICAgICAgICAgIGNvbnN0IGhpZGVVSWFuZFN0YXJ0R2FtZSA9IChzdGFydExldmVsOiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgICAgICBzdGFydEJ0bi5vbmNsaWNrID0gY29udGludWVCdG4ub25jbGljayA9IG51bGw7XG4gICAgICAgICAgICAgICAgaGlkZUVsZW1lbnQoW3RpdGxlRWxlbWVudCwgbWVudUVsZW1lbnQsIGRlc2NyaXB0aW9uRWxlbWVudF0sICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgc3RhcnRHYW1lKGNvbnRlbnRFbGVtZW50LCByZXNvdXJjZXMsIHN0YXJ0TGV2ZWwpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHN0YXJ0QnRuLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgc2F2ZUxldmVsKDApO1xuICAgICAgICAgICAgICAgIGhpZGVVSWFuZFN0YXJ0R2FtZSgwKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnRpbnVlQnRuLm9uY2xpY2sgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgaGlkZVVJYW5kU3RhcnRHYW1lKHNhdmVkTGV2ZWwpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gaGlkZVVJYW5kU3RhcnRHYW1lKDEwKTsgLy8gc2tpcCBtYWluIG1lbnUgYW5kIHN0YXJ0IHdpdGggbGV2ZWxcbiAgICAgICAgfSk7XG5cbiAgICB9KTtcbn07XG5cbnNob3dFbGVtZW50KHRpdGxlRWxlbWVudCwgcHJlcGFyZUdhbWUpO1xuIl19