import '@testing-library/jest-dom/vitest';

// jsdom nao implementa matchMedia, usado pelo ThemeProvider e pelos componentes
// que reagem ao breakpoint.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// ---------------------------------------------------------------------------
// APIs que o jsdom nao tem e os primitivos do Radix exigem.
//
// Sem elas, qualquer teste que abra um select ou um dialog falha por motivo
// alheio ao codigo sob teste (ADR-010).
// ---------------------------------------------------------------------------

class NoopObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
}

// Observador de layout: usado pelo Radix para posicionar popovers e pelos graficos.
Object.defineProperty(window, 'ResizeObserver', { writable: true, value: NoopObserver });
globalThis.ResizeObserver = NoopObserver as unknown as typeof ResizeObserver;

// Observador de interseccao: listas virtualizadas e conteudo preguicoso.
Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: NoopObserver });
globalThis.IntersectionObserver = NoopObserver as unknown as typeof IntersectionObserver;

// O jsdom declara os metodos abaixo, mas como stubs inoperantes: `scrollIntoView`
// lanca "not implemented" e `hasPointerCapture` devolve undefined onde o Radix
// espera um booleano. Por isso a atribuicao e incondicional — um guard do tipo
// `if (!Element.prototype.x)` nao substitui nada e o select trava ao abrir.
Element.prototype.scrollIntoView = function scrollIntoView(): void {};
Element.prototype.hasPointerCapture = function hasPointerCapture(): boolean {
  return false;
};
Element.prototype.setPointerCapture = function setPointerCapture(): void {};
Element.prototype.releasePointerCapture = function releasePointerCapture(): void {};

// O jsdom nao implementa PointerEvent. Sem ele, um `pointerdown` chega sem
// `button`/`pointerType` e o gatilho do select simplesmente nao abre — o teste
// entao expira esperando uma opcao que nunca aparece. As telas usam
// `userEvent`, que emite eventos de ponteiro, entao isto e obrigatorio.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly width: number;
    readonly height: number;
    readonly pressure: number;
    readonly tangentialPressure: number;
    readonly tiltX: number;
    readonly tiltY: number;
    readonly twist: number;
    readonly isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? 'mouse';
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tangentialPressure = params.tangentialPressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.twist = params.twist ?? 0;
      this.isPrimary = params.isPrimary ?? true;
    }

    getCoalescedEvents(): PointerEvent[] {
      return [];
    }

    getPredictedEvents(): PointerEvent[] {
      return [];
    }
  }

  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

// ---------------------------------------------------------------------------
// Curto-circuito de `:fullscreen` no seletor do jsdom.
//
// O `nwsapi` resolve `:fullscreen` chamando `element.matches(':fullscreen')` de
// volta, e cada avaliacao de `:modal` dispara uma cascata dessas chamadas. Ao
// fechar um Select do Radix numa tela cheia, medimos 58,5 milhoes de chamadas a
// `matches` a partir de 50 mil verificacoes de `:modal` — 40 segundos de CPU
// para escolher uma opcao, o que estoura o timeout de qualquer teste que filtre
// por um select. Com o curto-circuito, a mesma interacao custa ~120ms.
//
// Responder `false` nao e uma simplificacao: o jsdom nao implementa a
// Fullscreen API, entao `document.fullscreenElement` e sempre nulo e nenhum
// elemento pode estar em tela cheia. A resposta rapida e a resposta correta.
const matchesWithoutFullscreen = Element.prototype.matches;
Element.prototype.matches = function matches(this: Element, selectors: string): boolean {
  if (selectors === ':fullscreen') return false;
  return matchesWithoutFullscreen.call(this, selectors);
};
