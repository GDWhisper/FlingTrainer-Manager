# -*- coding: utf-8 -*-
"""生成应用图标：黑色渐变圆角方底 + 白色手柄 + 金色十字键。

形状来自定稿 mockup 的 SVG 路径（24 单位视图框），
以 1024px 超采样渲染后缩到 256 输出 PNG / 多尺寸 ICO。
用法: python scripts/gen-icon.py  （在仓库根目录执行）
"""
import math
import shutil
from PIL import Image, ImageChops, ImageDraw

S = 1024                       # 超采样画布
OUT_PNG = 'src/renderer/public/pic/app-icon-dark.png'
OUT_ICO = 'icon.ico'
OUT_ICO_BUILD = 'build/icon.ico'

# 布局：图标内容占 74% 画布宽，整体上移 1.6 单位（视觉居中）
K = 0.74 * S / 24.0
O = (S - 24 * K) / 2.0
DY = -1.6

BG_TOP = (29, 29, 35)          # #1d1d23
BG_BOT = (5, 5, 8)             # #050508
PAD = (255, 255, 255)
GOLD_TOP = (255, 223, 126)     # #ffdf7e
GOLD_BOT = (237, 161, 18)      # #eda112
GOLD_Y0, GOLD_Y1 = 9.3, 16.2   # 十字渐变覆盖的路径 y 范围
CORNER = 0.2237                # 圆角比例（Apple 风格）


def px(x, y):
    return (O + x * K, O + (y + DY) * K)


def lerp(c0, c1, t):
    return tuple(int(round(a + (b - a) * t)) for a, b in zip(c0, c1))


def arc_points(p0, p1, r, large, sweep, seg=64):
    """SVG arc (rx==ry, 无旋转) 端点参数化 → 折线点列（F.6.5）"""
    (x0, y0), (x1, y1) = p0, p1
    hx, hy = (x0 - x1) / 2.0, (y0 - y1) / 2.0
    ch2 = hx * hx + hy * hy
    if ch2 == 0:
        return [p1]
    rr = r * r
    if rr < ch2:               # 半径过小时按 SVG 规范放大
        r = math.sqrt(ch2)
        rr = r * r
    coef = math.sqrt(max(0.0, (rr - ch2) / ch2))
    sign = 1.0 if large != sweep else -1.0
    cx = (x0 + x1) / 2.0 + sign * hy * coef
    cy = (y0 + y1) / 2.0 - sign * hx * coef
    a0 = math.atan2(y0 - cy, x0 - cx)
    a1 = math.atan2(y1 - cy, x1 - cx)
    da = a1 - a0
    if sweep == 1 and da < 0:
        da += 2 * math.pi
    if sweep == 0 and da > 0:
        da -= 2 * math.pi
    return [(cx + r * math.cos(a0 + da * i / seg),
             cy + r * math.sin(a0 + da * i / seg)) for i in range(1, seg + 1)]


def gamepad_outline():
    """手柄外轮廓：只构建中轴右侧半边，再逐点镜像出左半边，
    保证左右握把像素级对称（mockup 原稿左握把连线 dy 误写 1.16
    导致变形，此处不再依赖原稿左半路径）。"""
    right = [
        ((12, 7), None),
        ((17.5, 7), None),
        ((23, 12.5), 5.5),                    # 右上角
        ((23, 16.5), None),
        ((18.5, 21), 4.5),                    # 右握把外弧
        ((15.12, 19.56), 4.7),                # 右握把内弧（原 a -3.38 -1.44）
        ((14, 17.4), None),
        ((12, 17.4), None),
    ]
    pts, cur = [], None
    for p, r in right:
        if r is None:
            pts.append(p)
        else:
            pts += arc_points(cur, p, r, 0, 1)
        cur = p
    pts += [(24.0 - x, y) for x, y in reversed(pts[1:-1])]
    return [(px(x, y)[0], px(x, y)[1]) for x, y in pts]


def main():
    # 背景：竖向渐变 + 圆角方形蒙版
    bg = Image.new('RGB', (S, S))
    d = ImageDraw.Draw(bg)
    for y in range(S):
        d.line([(0, y), (S, y)], fill=lerp(BG_TOP, BG_BOT, y / (S - 1)))
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, S - 1, S - 1], radius=int(CORNER * S), fill=255)
    img = bg.convert('RGBA')
    img.putalpha(mask)

    # 手柄本体：扫描线填充对左右边缘有固有不对称，先画蒙版
    # 再与自身镜像取并集，保证左右握把像素级对称
    pad_mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(pad_mask).polygon(gamepad_outline(), fill=255)
    pad_mask = ImageChops.lighter(pad_mask, pad_mask.transpose(Image.FLIP_LEFT_RIGHT))
    overlay = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    overlay.paste(Image.new('RGBA', (S, S), PAD + (255,)), (0, 0), pad_mask)

    # 金色十字：两根胶囊圆角杆共用一条竖向渐变
    grad = Image.new('RGBA', (S, S))
    gd = ImageDraw.Draw(grad)
    y_top, y_bot = px(0, GOLD_Y0)[1], px(0, GOLD_Y1)[1]
    for y in range(S):
        t = min(1.0, max(0.0, (y - y_top) / (y_bot - y_top)))
        gd.line([(0, y), (S, y)], fill=lerp(GOLD_TOP, GOLD_BOT, t) + (255,))
    cross = Image.new('L', (S, S), 0)
    cd = ImageDraw.Draw(cross)
    cd.rounded_rectangle([px(7.05, 9.3)[0], px(0, 9.3)[1],
                          px(9.15, 0)[0], px(0, 16.2)[1]],
                         radius=1.05 * K, fill=255)
    cd.rounded_rectangle([px(4.65, 0)[0], px(0, 11.7)[1],
                          px(11.55, 0)[0], px(0, 13.8)[1]],
                         radius=1.05 * K, fill=255)
    overlay.paste(grad, (0, 0), cross)

    # 打孔按键：透出背景渐变（上孔偏右、下孔偏左）
    for hx, hy in ((18.0, 11.8), (16.1, 14.2)):
        hole = Image.new('L', (S, S), 0)
        hd = ImageDraw.Draw(hole)
        cx, cy = px(hx, hy)
        r = 1.15 * K
        hd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
        overlay.paste(bg.convert('RGBA'), (0, 0), hole)

    img.alpha_composite(overlay)

    # 输出：PNG 256 / ICO 多尺寸
    png = img.resize((256, 256), Image.LANCZOS)
    png.save(OUT_PNG)
    img.save(OUT_ICO, format='ICO',
             sizes=[(256, 256), (64, 64), (48, 48), (32, 32), (16, 16)])
    shutil.copyfile(OUT_ICO, OUT_ICO_BUILD)
    print('done:', OUT_PNG, OUT_ICO, OUT_ICO_BUILD)


if __name__ == '__main__':
    main()
