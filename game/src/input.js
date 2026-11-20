// Keyboard and mouse: one shared input object the whole game reads. Keys
// are tracked by code (so WASD and arrows both work), the mouse position is
// kept in canvas pixels, and a click sets `shoot` for one tick. Nothing here
// knows about the game — main.js wires the two together.

export function makeInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
    handbrake: false,
    shoot: false,
    mouseX: 0,
    mouseY: 0,
    // Edge-triggered keys (true only on the tick they were pressed).
    pressed: {},
    keys: {},
  };
}

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  Space: 'handbrake',
};

export function bindInput(input, canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    const name = KEYMAP[e.code];
    if (name) {
      if (!input.keys[e.code]) input.pressed[name] = true;
      input[name] = true;
      input.keys[e.code] = true;
    }
    // Raw codes the game reads directly (Enter, Escape, E, R, Q, M).
    if (!input.keys[e.code]) input.pressed[e.code] = true;
    input.keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => {
    const name = KEYMAP[e.code];
    if (name) {
      input[name] = false;
      input.keys[e.code] = false;
    } else {
      input.keys[e.code] = false;
    }
  });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.shoot = true;
    const rect = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  });
  canvas.addEventListener('mouseup', () => {
    input.shoot = false;
  });
  // Keep the canvas focused so keys always arrive.
  canvas.setAttribute('tabindex', '0');
}

// Called at the end of each tick: edge triggers live for one tick only.
export function endTickInput(input) {
  input.pressed = {};
  // `shoot` is held while the mouse button is down; it is cleared on mouseup.
}
