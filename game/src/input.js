// SOLMAR — Vice Coast. Keyboard and mouse: the key set, the mouse position on
// the canvas, click edges and key edges (pressed() is true only on the frame
// the key goes down, so E and Enter never fire twice from one press).

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressedKeys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseClicked: false,
    pressed(code) {
      return this.pressedKeys.has(code);
    },
    endFrame() {
      this.pressedKeys.clear();
      this.mouseClicked = false;
    },
  };
  const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyM', 'KeyR', 'KeyQ', 'Enter', 'Escape'];
  window.addEventListener('keydown', (event) => {
    if (GAME_KEYS.includes(event.code)) event.preventDefault();
    if (!event.repeat) input.pressedKeys.add(event.code);
    input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      input.mouseDown = true;
      input.mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  return input;
}
