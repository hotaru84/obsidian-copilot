# フローティングUI刷新実装ガイド

## 概要

フローティングボタンとチャットウィンドウの構成を刷新します。以下を実装します：

1. **フローティングボタン**: ドラッグアンドドロップで位置調整可能（相対位置を保存）
2. **フローティングチャット**: ボタン基準のレイアウト、単体ドラッグは不可、リサイズ可能

## 完了した修正

✅ `src/plugin.ts`
- floatingButtonPosition設定を追加（right, bottom の相対位置）

✅ `styles.css`
- `.agent-client-floating-button` から bottom/right を削除
- cursor を pointer → grab に変更
- `.agent-client-floating-button.is-dragging` クラスを追加
- `.agent-client-floating-header` からドラッグカーソルを削除

## 必要な修正

### 1. FloatingButton.tsx の修正

**ファイル: `src/components/chat/FloatingButton.tsx`**

#### 1.1 インポート修正（行9-12）

**削除**:
```typescript
export const FLOATING_BUTTON_RIGHT = 40;
export const FLOATING_BUTTON_BOTTOM = 30;
```

**理由**: 相対位置を動的に管理するため、固定値は不要

#### 1.2 ドラッグ状態追加（FloatingButtonComponent内、行60-65）

**追加**（`const [showInstanceMenu...` の後に）:
```typescript
// Dragging state
const [relativePosRef, setRelativePosRef] = useState<{ right: number; bottom: number } | null>(
	() => {
		if (!settings.floatingButtonPosition) return null;
		return {
			right: settings.floatingButtonPosition.right,
			bottom: settings.floatingButtonPosition.bottom,
		};
	},
);
const [isDragging, setIsDragging] = useState(false);
const dragOffset = useRef({ x: 0, y: 0 });
const dragStartPos = useRef({ x: 0, y: 0 });
const wasDragged = useRef(false);
```

#### 1.3 絶対位置計算（行110付近、instanceLabels useMemoの直後）

**追加**:
```typescript
// Calculate absolute button position from relative position
const absoluteButtonPos = useMemo(() => {
	const right = relativePosRef?.right ?? 40;
	const bottom = relativePosRef?.bottom ?? 30;
	return {
		x: window.innerWidth - right - FLOATING_BUTTON_SIZE,
		y: window.innerHeight - bottom - FLOATING_BUTTON_SIZE,
		right,
		bottom,
	};
}, [relativePosRef]);
```

#### 1.4 ドラッグ処理追加（行140、「// ============...Button Click Logic...」より前）

**追加**:
```typescript
// ============================================================
// Dragging Logic
// ============================================================
const DRAG_THRESHOLD = 5;

const handleMouseDown = useCallback(
	(e: React.MouseEvent) => {
		setIsDragging(true);
		wasDragged.current = false;
		dragStartPos.current = { x: e.clientX, y: e.clientY };
		dragOffset.current = {
			x: e.clientX - absoluteButtonPos.x,
			y: e.clientY - absoluteButtonPos.y,
		};
		e.preventDefault();
	},
	[absoluteButtonPos],
);

useEffect(() => {
	if (!isDragging) return;

	const onMouseMove = (e: MouseEvent) => {
		const dx = e.clientX - dragStartPos.current.x;
		const dy = e.clientY - dragStartPos.current.y;
		if (
			!wasDragged.current &&
			Math.abs(dx) < DRAG_THRESHOLD &&
			Math.abs(dy) < DRAG_THRESHOLD
		) {
			return;
		}
		wasDragged.current = true;

		const newX = e.clientX - dragOffset.current.x;
		const newY = e.clientY - dragOffset.current.y;

		// Clamp to viewport
		const clampedX = Math.max(0, Math.min(newX, window.innerWidth - FLOATING_BUTTON_SIZE));
		const clampedY = Math.max(0, Math.min(newY, window.innerHeight - FLOATING_BUTTON_SIZE));

		// Convert back to relative position (right, bottom)
		const newRight = Math.max(0, window.innerWidth - clampedX - FLOATING_BUTTON_SIZE);
		const newBottom = Math.max(0, window.innerHeight - clampedY - FLOATING_BUTTON_SIZE);

		setRelativePosRef({ right: newRight, bottom: newBottom });

		// Emit custom event to notify chat views
		window.dispatchEvent(
			new CustomEvent("agent-client:floating-button-moved", {
				detail: {
					absoluteX: clampedX,
					absoluteY: clampedY,
					relativeRight: newRight,
					relativeBottom: newBottom,
				},
			}),
		);
	};

	const onMouseUp = () => {
		setIsDragging(false);
	};

	window.addEventListener("mousemove", onMouseMove);
	window.addEventListener("mouseup", onMouseUp);
	return () => {
		window.removeEventListener("mousemove", onMouseMove);
		window.removeEventListener("mouseup", onMouseUp);
	};
}, [isDragging]);

// Save relative position to settings (debounced)
useEffect(() => {
	if (!relativePosRef) return;
	const timer = setTimeout(() => {
		if (
			!settings.floatingButtonPosition ||
			relativePosRef.right !== settings.floatingButtonPosition.right ||
			relativePosRef.bottom !== settings.floatingButtonPosition.bottom
		) {
			void plugin.saveSettingsAndNotify({
				...plugin.settings,
				floatingButtonPosition: relativePosRef,
			});
		}
	}, 500);
	return () => clearTimeout(timer);
}, [relativePosRef, plugin, settings.floatingButtonPosition]);

// Update button position when window resizes (to maintain relative position)
useEffect(() => {
	const handleWindowResize = () => {
		// Position is automatically recalculated via useMemo
		// Emit event to notify chat views of new button position
		if (relativePosRef) {
			const absX = window.innerWidth - relativePosRef.right - FLOATING_BUTTON_SIZE;
			const absY = window.innerHeight - relativePosRef.bottom - FLOATING_BUTTON_SIZE;
			window.dispatchEvent(
				new CustomEvent("agent-client:floating-button-moved", {
					detail: {
						absoluteX: absX,
						absoluteY: absY,
						relativeRight: relativePosRef.right,
						relativeBottom: relativePosRef.bottom,
					},
				}),
			);
		}
	};

	window.addEventListener("resize", handleWindowResize);
	return () => {
		window.removeEventListener("resize", handleWindowResize);
	};
}, [relativePosRef]);
```

#### 1.5 JSXの修正

**行175-185 (buttonClassName定義)**
```typescript
const buttonClassName = [
	"agent-client-floating-button",
	floatingButtonImageSrc ? "has-custom-image" : "",
	isDragging ? "is-dragging" : "",
]
	.filter(Boolean)
	.join(" ");
```

**行186-192 (div開始タグ)**
```typescript
<div
	className={buttonClassName}
	onMouseDown={handleMouseDown}
	onMouseUp={() => {
		if (!wasDragged.current) {
			handleButtonClick();
		}
	}}
	style={{
		left: absoluteButtonPos.x,
		top: absoluteButtonPos.y,
		right: "auto",
		bottom: "auto",
	}}
>
```

**行215 (インスタンスメニューのポジション)**
```typescript
{showInstanceMenu && (
	<div
		ref={instanceMenuRef}
		className="agent-client-floating-instance-menu"
		style={{
			bottom: window.innerHeight - absoluteButtonPos.y + 10,
			...(absoluteButtonPos.x + MENU_MIN_WIDTH > window.innerWidth
				? {
						right:
							window.innerWidth -
							(absoluteButtonPos.x + FLOATING_BUTTON_SIZE),
						left: "auto",
						top: "auto",
					}
				: {
						left: absoluteButtonPos.x,
						right: "auto",
						top: "auto",
					}),
		}}
	>
```

### 2. FloatingChatView.tsx の修正

**ファイル: `src/components/chat/FloatingChatView.tsx`**

#### 2.1 インポート修正（行24-28）

**変更前**:
```typescript
import { clampPosition } from "../../shared/floating-utils";
import {
	FLOATING_BUTTON_SIZE,
	FLOATING_BUTTON_RIGHT,
	FLOATING_BUTTON_BOTTOM,
} from "./FloatingButton";
```

**変更後**:
```typescript
import { clampPosition } from "../../shared/floating-utils";
import { FLOATING_BUTTON_SIZE } from "./FloatingButton";
```

#### 2.2 UI State修正（行253-290）

**削除する部分**:
- `const [position, setPosition]` の初期化ロジック全体で、FLOATING_BUTTON_RIGHT, FLOATING_BUTTON_BOTTOM を使用している部分
- `const [isDragging, setIsDragging]`
- `const dragOffset = useRef`

**追加する部分**:
```typescript
// UI State (View-Specific)
const [isExpanded, setIsExpanded] = useState(initialExpanded);
const [size, setSize] = useState(settings.floatingWindowSize);
const [buttonPosition, setButtonPosition] = useState<{
	x: number;
	y: number;
	right: number;
	bottom: number;
} | null>(null);
```

#### 2.3 ボタン位置初期化useEffect追加

```typescript
useEffect(() => {
	// Initialize button position based on settings
	if (settings.floatingButtonPosition) {
		const absX = window.innerWidth - settings.floatingButtonPosition.right - FLOATING_BUTTON_SIZE;
		const absY = window.innerHeight - settings.floatingButtonPosition.bottom - FLOATING_BUTTON_SIZE;
		setButtonPosition({
			x: absX,
			y: absY,
			right: settings.floatingButtonPosition.right,
			bottom: settings.floatingButtonPosition.bottom,
		});
	} else {
		// Default position
		const defRight = 40;
		const defBottom = 30;
		const absX = window.innerWidth - defRight - FLOATING_BUTTON_SIZE;
		const absY = window.innerHeight - defBottom - FLOATING_BUTTON_SIZE;
		setButtonPosition({
			x: absX,
			y: absY,
			right: defRight,
			bottom: defBottom,
		});
	}
}, [settings.floatingButtonPosition]);
```

#### 2.4 ボタン移動イベントリスナー追加

```typescript
useEffect(() => {
	const onButtonMoved = (event: Event) => {
		const customEvent = event as CustomEvent<{
			absoluteX: number;
			absoluteY: number;
			relativeRight: number;
			relativeBottom: number;
		}>;
		setButtonPosition({
			x: customEvent.detail.absoluteX,
			y: customEvent.detail.absoluteY,
			right: customEvent.detail.relativeRight,
			bottom: customEvent.detail.relativeBottom,
		});
	};

	window.addEventListener("agent-client:floating-button-moved", onButtonMoved);
	return () => {
		window.removeEventListener("agent-client:floating-button-moved", onButtonMoved);
	};
}, []);
```

#### 2.5 チャット位置計算（useMemoで追加）

```typescript
const position = useMemo(() => {
	if (!buttonPosition) return { x: 0, y: 0 };

	// Position chat window to the left and above the button
	const chatX = buttonPosition.x - size.width - 20;
	const chatY = buttonPosition.y - size.height + FLOATING_BUTTON_SIZE;

	// Clamp to viewport
	return {
		x: Math.max(0, Math.min(chatX, window.innerWidth - size.width)),
		y: Math.max(0, Math.min(chatY, window.innerHeight - size.height)),
	};
}, [buttonPosition, size.width, size.height]);
```

#### 2.6 ドラッグ関連コード削除

**削除**:
- `const [isDragging, setIsDragging]` 状態
- `const dragOffset = useRef`
- `const onMouseDown = useCallback` 関数
- ドラッグ処理の useEffect
- 位置保存（`floatingWindowPosition` 関連）の useEffect

#### 2.7 ドラッグハンドラー削除（JSXから）

**行749行付近**:
```typescript
<div
	className="agent-client-floating-header"
	// onMouseDown={onMouseDown} ← この行を削除
>
```

#### 2.8 新しいウィンドウ作成の簡略化

```typescript
const handleOpenNewFloatingChat = useCallback(() => {
	// デフォルト位置を使用（新しいウィンドウの初期値）
	plugin.openNewFloatingChat(true);
}, [plugin]);
```

## 実装手順

1. FloatingButton.tsx を上記1.1～1.5に従い修正
2. FloatingChatView.tsx を上記2.1～2.8に従い修正
3. ビルド実行: `npm run build`
4. エラーがあればしたがって修正

## テスト項目

1. ボタンをドラッグして位置変更できるか
2. ウィンドウをリサイズしてもボタンが相対位置を保つか
3. チャットがボタンから離して配置されているか
4. チャットはドラッグで位置変更可能か
5. チャットはリサイズ可能か
6. ページリロード後もボタン位置が保持されるか

