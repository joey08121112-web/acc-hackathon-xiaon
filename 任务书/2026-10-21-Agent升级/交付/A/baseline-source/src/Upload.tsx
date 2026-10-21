import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Crop,
  Eraser,
  ImagePlus,
  ShieldCheck,
  Trash2,
  Undo2,
} from "lucide-react";
type Rect = { x: number; y: number; w: number; h: number };
export const IMAGE_KEY = "xiaon-image-v1";
export function Upload({
  onConfirm,
  initialText,
}: {
  onConfirm: (text: string) => void;
  initialText: string;
}) {
  const [src, setSrc] = useState(() => {
    try {
      return localStorage.getItem(IMAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [saved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("xiaon-image-work-v1") || "{}");
    } catch {
      return {};
    }
  });
  const [stage, setStage] = useState<number>(saved.stage || 0),
    [crop, setCrop] = useState(
      saved.crop || { left: 0, top: 0, right: 0, bottom: 0 },
    ),
    [masks, setMasks] = useState<Rect[]>(saved.masks || []),
    [preview, setPreview] = useState<Rect | null>(null),
    [message, setMessage] = useState(""),
    [text, setText] = useState(saved.text || initialText);
  const canvas = useRef<HTMLCanvasElement>(null),
    img = useRef<HTMLImageElement | null>(null),
    start = useRef<{ x: number; y: number } | null>(null),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      localStorage.setItem(
        "xiaon-image-work-v1",
        JSON.stringify({ stage, crop, masks, text }),
      );
    } catch {
      setMessage("图片处理步骤未能保存，当前页面仍可继续。");
    }
  }, [stage, crop, masks, text]);
  const paint = () => {
    const c = canvas.current,
      i = img.current;
    if (!c || !i) return;
    c.width = i.naturalWidth;
    c.height = i.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(i, 0, 0);
    for (const r of [...masks, ...(preview ? [preview] : [])]) {
      ctx.fillStyle = "#293c32";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
  };
  useEffect(() => {
    if (!src) return;
    const i = new Image();
    i.onload = () => {
      img.current = i;
      paint();
    };
    i.src = src;
  }, [src, stage]);
  useEffect(paint, [masks, preview]);
  const save = (data: string) => {
    setSrc(data);
    try {
      localStorage.setItem(IMAGE_KEY, data);
    } catch {
      setMessage("图片较大，当前页面可继续；图片没有保存，刷新后请重新选择。");
    }
  };
  const sample = () => {
    const c = document.createElement("canvas");
    c.width = 1000;
    c.height = 650;
    const x = c.getContext("2d")!;
    x.fillStyle = "#fffdf4";
    x.fillRect(0, 0, 1000, 650);
    x.fillStyle = "#60695b";
    x.font = "26px sans-serif";
    x.fillText("示例学习单 · 虚构资料", 60, 60);
    x.fillText("姓名：林同学（虚构）    班级：七年级 2 班", 60, 120);
    x.strokeStyle = "#dce3d0";
    for (let y = 180; y < 650; y += 65) {
      x.beginPath();
      x.moveTo(40, y);
      x.lineTo(960, y);
      x.stroke();
    }
    x.font = "36px sans-serif";
    x.fillStyle = "#263c31";
    x.fillText("化简：3x − (2x − 5)", 70, 260);
    x.font = "30px sans-serif";
    x.fillStyle = "#68796a";
    x.fillText("我的尝试：3x − 2x − 5 = x − 5", 70, 390);
    save(c.toDataURL("image/png"));
    setMasks([]);
    setStage(1);
  };
  const file = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setMessage("请选择可读取的图片文件。");
      return;
    }
    try {
      const bitmap = await createImageBitmap(f),
        ratio = Math.min(1, 1100 / Math.max(bitmap.width, bitmap.height));
      const c = document.createElement("canvas");
      c.width = bitmap.width * ratio;
      c.height = bitmap.height * ratio;
      c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
      save(c.toDataURL("image/jpeg", 0.82));
      bitmap.close();
      setMasks([]);
      setStage(1);
    } catch {
      setMessage("这张图片暂时无法读取，请换一张或选择示例。");
    }
  };
  const cropNow = () => {
    const c = canvas.current;
    if (!c) return;
    const left = (c.width * crop.left) / 100,
      top = (c.height * crop.top) / 100,
      w = (c.width * (100 - crop.left - crop.right)) / 100,
      h = (c.height * (100 - crop.top - crop.bottom)) / 100;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    out.getContext("2d")!.drawImage(c, left, top, w, h, 0, 0, w, h);
    save(out.toDataURL("image/png"));
    setCrop({ left: 0, top: 0, right: 0, bottom: 0 });
    setStage(2);
  };
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current!,
      r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * c.width) / r.width,
      y: ((e.clientY - r.top) * c.height) / r.height,
    };
  };
  const remove = () => {
    localStorage.removeItem(IMAGE_KEY);
    setSrc("");
    setMasks([]);
    setStage(0);
    setText("3x − (2x − 5)");
    setMessage("已移除这张图片及对应的本机核对内容。");
    onConfirm("");
  };
  return (
    <div className="upload-flow">
      <div className="step-track">
        {["选图片", "裁剪", "遮挡", "核对"].map((t, i) => (
          <span
            className={stage === i ? "current" : stage > i ? "done" : ""}
            key={t}
          >
            {stage > i ? <Check size={13} /> : i + 1} {t}
          </span>
        ))}
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {stage === 0 ? (
        <>
          <div className="upload-empty">
            <div className="camera-emblem">
              <Camera size={34} />
            </div>
            <h2>只带上这一道题</h2>
            <p>
              先裁剪，再遮挡姓名、学校等信息。
              <br />
              图片只在这台设备里处理。
            </p>
            <button className="primary" onClick={sample}>
              <ImagePlus size={18} /> 使用示例学习单
            </button>
            <button
              className="secondary"
              onClick={() => input.current?.click()}
            >
              选择本地图片
            </button>
            <input
              type="file"
              ref={input}
              accept="image/*"
              hidden
              onChange={(e) => file(e.target.files?.[0])}
            />
          </div>
          {src && (
            <button className="wide secondary" onClick={() => setStage(1)}>
              继续上次的图片
            </button>
          )}
        </>
      ) : (
        <>
          <div className="photo-area">
            <canvas
              ref={canvas}
              className={stage === 2 ? "mask-canvas" : ""}
              style={
                stage === 1
                  ? {
                      clipPath: `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)`,
                    }
                  : undefined
              }
              aria-label="待处理的学习单图片"
              onPointerDown={(e) => {
                if (stage !== 2) return;
                start.current = point(e);
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (stage !== 2 || !start.current) return;
                const p = point(e);
                setPreview({
                  x: Math.min(p.x, start.current.x),
                  y: Math.min(p.y, start.current.y),
                  w: Math.abs(p.x - start.current.x),
                  h: Math.abs(p.y - start.current.y),
                });
              }}
              onPointerUp={(e) => {
                if (stage !== 2 || !start.current) return;
                const p = point(e),
                  r = {
                    x: Math.min(p.x, start.current.x),
                    y: Math.min(p.y, start.current.y),
                    w: Math.abs(p.x - start.current.x),
                    h: Math.abs(p.y - start.current.y),
                  };
                if (r.w < 10 || r.h < 10) {
                  r.x = Math.max(0, p.x - 100);
                  r.y = Math.max(0, p.y - 30);
                  r.w = 200;
                  r.h = 60;
                }
                setMasks((m) => [...m, r]);
                setPreview(null);
                start.current = null;
              }}
              onPointerCancel={() => {
                start.current = null;
                setPreview(null);
              }}
            />
          </div>
          {stage === 1 && (
            <>
              <h2>
                <Crop size={20} /> 留下题目所在区域
              </h2>
              <p>移动四边滑块调整范围。浅色区将被裁去。</p>
              <div className="crop-controls">
                {(["left", "top", "right", "bottom"] as const).map((key, i) => (
                  <label key={key}>
                    {["左边", "上边", "右边", "下边"][i]}{" "}
                    <input
                      aria-label={`裁剪${["左边", "上边", "右边", "下边"][i]}`}
                      type="range"
                      min="0"
                      max="40"
                      value={crop[key]}
                      onChange={(e) =>
                        setCrop({ ...crop, [key]: Number(e.target.value) })
                      }
                    />
                    <span>{crop[key]}%</span>
                  </label>
                ))}
              </div>
              <button className="primary wide" onClick={cropNow}>
                应用裁剪，继续遮挡 <Crop size={17} />
              </button>
            </>
          )}
          {stage === 2 && (
            <>
              <h2>
                <Eraser size={20} /> 遮住不需要的信息
              </h2>
              <p>
                在图片上拖出矩形；也可以点击一处，放置遮挡块。确认姓名、学校、联系方式不再可见。
              </p>
              <div className="button-row">
                <button
                  className="secondary"
                  onClick={() => setMasks((m) => m.slice(0, -1))}
                  disabled={!masks.length}
                >
                  <Undo2 size={17} />
                  撤销遮挡
                </button>
                <span className="muted">已遮挡 {masks.length} 处</span>
                <button
                  className="secondary"
                  onClick={() => {
                    const i = img.current;
                    if (i)
                      setMasks((m) => [
                        ...m,
                        {
                          x: 0,
                          y: i.naturalHeight * 0.1,
                          w: i.naturalWidth,
                          h: i.naturalHeight * 0.13,
                        },
                      ]);
                  }}
                >
                  遮挡顶部信息栏
                </button>
              </div>
              <div className="notice">
                <ShieldCheck size={17} />
                本演示没有上传服务。确认后只保留本机处理后的图片。
              </div>
              <button
                className="primary wide"
                onClick={() => {
                  if (canvas.current)
                    save(canvas.current.toDataURL("image/png"));
                  setMasks([]);
                  setStage(3);
                }}
              >
                确认使用处理后的图片
              </button>
            </>
          )}
          {stage === 3 && (
            <>
              <div className="notice">
                示例识别结果 · 未接入 OCR
                <br />
                下方固定示例并非对任意图片的真实识别，请手动核对和修改。
              </div>
              <label className="field">
                核对题目内容
                <textarea
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              <button
                className="primary wide"
                disabled={!text.trim()}
                onClick={() => {
                  onConfirm(text.trim());
                  setMessage("题目已在本机核对保存。");
                }}
              >
                确认题目内容 <Check size={18} />
              </button>
              <button className="text-button" onClick={() => setStage(1)}>
                重新裁剪这张图片
              </button>
            </>
          )}
          <button className="text-button danger" onClick={remove}>
            <Trash2 size={16} /> 移除图片和核对内容
          </button>
        </>
      )}
    </div>
  );
}
