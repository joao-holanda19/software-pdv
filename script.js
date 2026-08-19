/**
 * ============================================================================
 * SISTEMA PDV TOTEM DE AUTOATENDIMENTO - KNC BRASIL
 * ============================================================================
 * Arquivo: script.js
 * Descrição: Lógica central do totem, gerenciamento de LocalStorage para produtos,
 *            leitura de código de barras (EAN) e QR Code, teclado touch,
 *            carrinho de compras, simulação de pagamentos e painel administrativo.
 * ============================================================================
 */

// Chave utilizada para persistência no LocalStorage do navegador
const STORAGE_KEY_PRODUCTS = "knc_pdv_produtos_v1";

// Catálogo Padrão Inicial (carregado caso o LocalStorage esteja vazio)
const DEFAULT_PRODUCTS_CATALOG = [
  {
    id: "prod-1",
    ean: "7894900011517",
    qrcode: "KNC-PROD-001",
    nome: "Coca-Cola Original 350ml",
    descricao: "Refrigerante lata 350ml gelada",
    preco: 7.00,
    categoria: "Bebidas",
    imagem: ""
  },
  {
    id: "prod-2",
    ean: "7891000100103",
    qrcode: "KNC-PROD-002",
    nome: "Achocolatado Nescau 200ml",
    descricao: "Bebida láctea sabor chocolate pronta",
    preco: 11.00,
    categoria: "Bebidas",
    imagem: ""
  },
  {
    id: "prod-3",
    ean: "7896052600014",
    qrcode: "KNC-PROD-003",
    nome: "Guaraná Jesus 350ml",
    descricao: "Refrigerante típico sabor cravo e canela",
    preco: 9.00,
    categoria: "Bebidas",
    imagem: ""
  },
  {
    id: "prod-4",
    ean: "7891000248706",
    qrcode: "KNC-PROD-004",
    nome: "Chocolate Barra 90g",
    descricao: "Chocolate ao leite cremoso",
    preco: 8.50,
    categoria: "Snacks",
    imagem: ""
  },
  {
    id: "prod-5",
    ean: "7894900700046",
    qrcode: "KNC-PROD-005",
    nome: "Água Mineral Crystal 500ml",
    descricao: "Água mineral natural sem gás",
    preco: 4.50,
    categoria: "Bebidas",
    imagem: ""
  }
];

// ============================================================================
// 1. ESTADO GLOBAL DA SESSÃO DO TOTEM
// ============================================================================
const SessionState = {
  currentStep: "home",
  cart: [],
  customer: {
    isIdentified: false,
    cpf: ""
  },
  selectedPaymentMethod: "",
  autoReturnTimer: null,
  inactivityTimer: null,
  longPressTimer: null
};

// ============================================================================
// 2. MÓDULO DE STORAGE (GERENCIAMENTO DO LOCALSTORAGE)
// ============================================================================
const StorageManager = {
  /**
   * Inicializa o LocalStorage com o catálogo padrão se ainda não existir.
   */
  init() {
    const existing = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (!existing) {
      this.saveAll(DEFAULT_PRODUCTS_CATALOG);
      console.log("Catálogo KNC padrão inicializado no LocalStorage.");
    }
  },

  /**
   * Retorna todos os produtos cadastrados no LocalStorage.
   * @returns {Array} Lista de produtos
   */
  getAll() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_PRODUCTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Erro ao ler dados do LocalStorage:", e);
      return DEFAULT_PRODUCTS_CATALOG;
    }
  },

  /**
   * Salva a lista completa de produtos no LocalStorage.
   * @param {Array} products 
   */
  saveAll(products) {
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
    } catch (e) {
      console.error("Erro ao salvar no LocalStorage:", e);
    }
  },

  /**
   * Busca um produto tanto pelo EAN (código de barras) quanto pelo QRCode.
   * @param {string} code Código lido pelo scanner
   * @returns {Object|null} Produto encontrado ou null
   */
  findByCode(code) {
    if (!code) return null;
    const cleanCode = code.trim().toLowerCase();
    const products = this.getAll();
    
    return products.find(p => 
      (p.ean && p.ean.trim().toLowerCase() === cleanCode) ||
      (p.qrcode && p.qrcode.trim().toLowerCase() === cleanCode)
    ) || null;
  },

  /**
   * Adiciona ou atualiza um produto no LocalStorage.
   * @param {Object} productData Dados do produto
   */
  upsert(productData) {
    const products = this.getAll();
    const index = products.findIndex(p => p.id === productData.id || p.ean === productData.ean);

    if (index >= 0) {
      products[index] = { ...products[index], ...productData };
    } else {
      const newProduct = {
        id: productData.id || `prod-${Date.now()}`,
        ...productData
      };
      products.push(newProduct);
    }

    this.saveAll(products);
    renderAdminProductsTable();
    renderShelfDemoProducts();
  },

  /**
   * Remove um produto pelo seu ID.
   * @param {string} id ID do produto
   */
  deleteById(id) {
    const products = this.getAll().filter(p => p.id !== id);
    this.saveAll(products);
    renderAdminProductsTable();
    renderShelfDemoProducts();
  },

  /**
   * Restaura o catálogo para o padrão de fábrica.
   */
  resetToDefault() {
    this.saveAll(DEFAULT_PRODUCTS_CATALOG);
    renderAdminProductsTable();
    renderShelfDemoProducts();
  }
};

// ============================================================================
// 3. EFEITO SONORO SINTETIZADO (FEEDBACK DE BIP DE SCANNER)
// ============================================================================
const SoundFX = {
  ctx: null,
  
  init() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    } catch (e) {}
  },

  playBeep(freq = 1800, type = "sine", duration = 0.08) {
    try {
      if (!this.ctx) this.init();
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }
};

// ============================================================================
// 4. NAVEGAÇÃO ENTRE AS TELAS DO TOTEM
// ============================================================================
/**
 * Alterna a tela ativa do Totem.
 * @param {string} stepName Nome do passo ('home', 'cliente', 'escanear', 'carrinho', 'checkout', 'confirmacao')
 */
function goToStep(stepName) {
  SessionState.currentStep = stepName;

  // Atualiza classes ativas
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });

  const targetScreen = document.getElementById(`step-${stepName}`);
  if (targetScreen) {
    targetScreen.classList.add("active");
  }

  // Ações específicas de entrada em cada tela
  if (stepName === "home") {
    clearAutoReturnTimer();
    const video = document.getElementById("home-video-player");
    if (video && video.paused) {
      video.play().catch(() => {});
    }
  } else if (stepName === "cliente") {
    updateCpfDisplay();
  } else if (stepName === "escanear") {
    renderShelfDemoProducts();
    updateScannerCartIndicator();
  } else if (stepName === "carrinho") {
    renderCart();
  } else if (stepName === "checkout") {
    updateCheckoutTotals();
  } else if (stepName === "confirmacao") {
    startAutoReturnCountdown();
  }

  resetInactivityTimer();
}

/**
 * Tocar em qualquer ponto da tela inicial avança para a etapa de identificação.
 */
function handleHomeTap(e) {
  // Ignora se o clique for no botão de Admin
  if (e.target.closest(".admin-hint")) return;
  goToStep("cliente");
}

// ============================================================================
// 5. FLUXO DE IDENTIFICAÇÃO DO CLIENTE & TECLADO VIRTUAL TOUCH
// ============================================================================
let currentCpfRaw = "";

function setCustomerType(isMember) {
  SessionState.customer.isIdentified = isMember;
  
  const cardSim = document.getElementById("card-sim");
  const cardNao = document.getElementById("card-nao");
  const cpfContainer = document.getElementById("cpf-container");
  const btnConfirm = document.getElementById("btn-confirm-cpf");

  if (isMember) {
    cardSim.classList.add("active");
    cardNao.classList.remove("active");
    cardSim.querySelector(".choice-radio-indicator").innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    cardNao.querySelector(".choice-radio-indicator").innerHTML = '<i class="fa-regular fa-circle"></i>';
    cpfContainer.style.display = "flex";
    btnConfirm.innerHTML = '<span>Continuar para Leitura</span> <i class="fa-solid fa-arrow-right"></i>';
  } else {
    cardSim.classList.remove("active");
    cardNao.classList.add("active");
    cardSim.querySelector(".choice-radio-indicator").innerHTML = '<i class="fa-regular fa-circle"></i>';
    cardNao.querySelector(".choice-radio-indicator").innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    cpfContainer.style.display = "none";
    btnConfirm.innerHTML = '<span>Continuar sem CPF</span> <i class="fa-solid fa-arrow-right"></i>';
  }
}

function keypadPress(digit) {
  if (currentCpfRaw.length < 11) {
    currentCpfRaw += digit;
    updateCpfDisplay();
  }
}

function keypadBackspace() {
  if (currentCpfRaw.length > 0) {
    currentCpfRaw = currentCpfRaw.slice(0, -1);
    updateCpfDisplay();
  }
}

function clearCpfInput() {
  currentCpfRaw = "";
  updateCpfDisplay();
}

function formatCpf(raw) {
  if (!raw) return "";
  let v = raw.replace(/\D/g, "");
  if (v.length > 3) v = v.replace(/^(\d{3})(\d)/, "$1.$2");
  if (v.length > 6) v = v.replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3");
  if (v.length > 9) v = v.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
  return v;
}

function updateCpfDisplay() {
  const display = document.getElementById("cpf-display-text");
  if (!display) return;

  if (currentCpfRaw.length === 0) {
    display.innerText = "000.000.000-00";
    display.classList.add("cpf-text-placeholder");
  } else {
    display.innerText = formatCpf(currentCpfRaw);
    display.classList.remove("cpf-text-placeholder");
  }

  const hiddenInput = document.getElementById("cpf-hidden-input");
  if (hiddenInput) hiddenInput.value = formatCpf(currentCpfRaw);
}

function confirmCpfAndProceed() {
  if (SessionState.customer.isIdentified && currentCpfRaw.length > 0) {
    SessionState.customer.cpf = formatCpf(currentCpfRaw);
  } else {
    SessionState.customer.cpf = "";
  }
  goToStep("escanear");
}

// Sincronização com digitação por teclado físico no campo oculto
document.addEventListener("DOMContentLoaded", () => {
  const hiddenInput = document.getElementById("cpf-hidden-input");
  if (hiddenInput) {
    hiddenInput.addEventListener("input", (e) => {
      currentCpfRaw = e.target.value.replace(/\D/g, "").slice(0, 11);
      updateCpfDisplay();
    });
  }
});

// ============================================================================
// 6. MOTOR DE CAPTURA DO SCANNER (EAN / QR CODE / LEITOR FÍSICO USB)
// ============================================================================
let barcodeBuffer = "";
let lastKeyTime = Date.now();

// Captura automática de leitura do leitor físico USB / teclado
window.addEventListener("keydown", (e) => {
  // Ignora se estiver digitando em campos de formulário no modal administrativo
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA")) {
    if (e.target.id !== "cpf-hidden-input") return;
  }

  // Atalho de teclado para abrir o painel de administração: Ctrl + Shift + P
  if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
    e.preventDefault();
    openAdminModal();
    return;
  }

  const currentTime = Date.now();

  // Leitores de código de barras enviam caracteres em altíssima velocidade (< 80ms)
  if (currentTime - lastKeyTime > 120) {
    barcodeBuffer = "";
  }
  lastKeyTime = currentTime;

  if (e.key === "Enter") {
    if (barcodeBuffer.trim().length > 0) {
      processScannedCode(barcodeBuffer.trim());
      barcodeBuffer = "";
    }
  } else if (e.key.length === 1) {
    barcodeBuffer += e.key;
  }
});

/**
 * Processa um código bipado ou simulado.
 * @param {string} code Código EAN ou QRCode
 */
function processScannedCode(code) {
  if (!code) return;

  SoundFX.playBeep(2200, "sine", 0.1);

  // Busca o produto no LocalStorage
  let product = StorageManager.findByCode(code);

  // Se o item não existir, cria uma entrada de demonstração automática
  if (!product) {
    const randomPrice = parseFloat((Math.random() * (24.90 - 5.50) + 5.50).toFixed(2));
    product = {
      id: `temp-${Date.now()}`,
      ean: code,
      qrcode: `QR-${code}`,
      nome: `Item Escaneado (${code})`,
      descricao: "Produto identificado automaticamente pelo leitor",
      preco: randomPrice,
      categoria: "Outros",
      imagem: ""
    };
  }

  // Adiciona ao carrinho
  addItemToCart(product);
  
  // Se estiver na tela de escaneamento, avança para o carrinho
  if (SessionState.currentStep === "escanear" || SessionState.currentStep === "home" || SessionState.currentStep === "cliente") {
    goToStep("carrinho");
  } else if (SessionState.currentStep === "carrinho") {
    renderCart();
  }
}

/**
 * Renderiza a prateleira de demonstração rápida na tela de scanner.
 */
function renderShelfDemoProducts() {
  const shelf = document.getElementById("shelf-demo-products");
  if (!shelf) return;

  const products = StorageManager.getAll();
  shelf.innerHTML = "";

  products.forEach(p => {
    const card = document.createElement("div");
    card.className = "shelf-item-card";
    card.onclick = () => processScannedCode(p.ean || p.qrcode);
    card.innerHTML = `
      <span class="item-name">${p.nome}</span>
      <span class="item-price">R$ ${p.preco.toFixed(2).replace(".", ",")}</span>
      <span class="item-ean"><i class="fa-solid fa-barcode"></i> ${p.ean}</span>
    `;
    shelf.appendChild(card);
  });
}

function updateScannerCartIndicator() {
  const footerBar = document.getElementById("scanner-footer-bar");
  const countLabel = document.getElementById("scanner-cart-items-count");
  if (!footerBar || !countLabel) return;

  const totalItems = SessionState.cart.reduce((sum, item) => sum + item.qty, 0);
  if (totalItems > 0) {
    footerBar.style.display = "flex";
    countLabel.innerText = `${totalItems} ${totalItems === 1 ? "item" : "itens"} no carrinho`;
  } else {
    footerBar.style.display = "none";
  }
}

// ============================================================================
// 7. GESTÃO DO CARRINHO DE COMPRAS
// ============================================================================
function addItemToCart(product) {
  const existingItem = SessionState.cart.find(item => 
    (item.ean && item.ean === product.ean) || (item.id && item.id === product.id)
  );

  if (existingItem) {
    existingItem.qty += 1;
  } else {
    SessionState.cart.push({
      ...product,
      qty: 1
    });
  }

  updateScannerCartIndicator();
}

function changeItemQty(code, delta) {
  const item = SessionState.cart.find(i => i.ean === code || i.id === code);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    removeItemFromCart(code);
  } else {
    renderCart();
  }
}

function removeItemFromCart(code) {
  SessionState.cart = SessionState.cart.filter(i => i.ean !== code && i.id !== code);
  renderCart();
  updateScannerCartIndicator();
}

function promptClearCart() {
  if (SessionState.cart.length === 0) return;
  SessionState.cart = [];
  renderCart();
  updateScannerCartIndicator();
}

function calculateCartTotal() {
  return SessionState.cart.reduce((sum, item) => sum + (item.preco * item.qty), 0);
}

function renderCart() {
  const tbody = document.getElementById("cart-items-tbody");
  const emptyState = document.getElementById("cart-empty-state");
  const table = document.getElementById("cart-table");
  const countLabel = document.getElementById("cart-item-count-label");
  const totalValueEl = document.getElementById("cart-total-value");
  const customerBadgeText = document.getElementById("cart-customer-text");
  const btnFinish = document.getElementById("btn-finish-order");

  if (!tbody) return;

  // Atualiza identificação do cliente no resumo
  if (customerBadgeText) {
    if (SessionState.customer.cpf) {
      customerBadgeText.innerHTML = `Cliente: <strong>${SessionState.customer.cpf}</strong>`;
    } else {
      customerBadgeText.innerText = "Cliente Não Identificado";
    }
  }

  const totalQty = SessionState.cart.reduce((sum, i) => sum + i.qty, 0);
  if (countLabel) {
    countLabel.innerText = `${totalQty} ${totalQty === 1 ? "item adicionado" : "itens adicionados"}`;
  }

  if (SessionState.cart.length === 0) {
    tbody.innerHTML = "";
    if (table) table.style.display = "none";
    if (emptyState) emptyState.style.display = "flex";
    if (totalValueEl) totalValueEl.innerText = "R$ 0,00";
    if (btnFinish) btnFinish.disabled = true;
    return;
  }

  if (table) table.style.display = "table";
  if (emptyState) emptyState.style.display = "none";
  if (btnFinish) btnFinish.disabled = false;

  tbody.innerHTML = "";
  let total = 0;

  SessionState.cart.forEach(item => {
    const itemSubtotal = item.preco * item.qty;
    total += itemSubtotal;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="item-main-cell">
          <span class="item-main-name">${item.nome}</span>
          ${item.descricao ? `<span class="item-main-desc">${item.descricao}</span>` : ""}
          <span class="item-main-code">EAN: ${item.ean || "-"} | QR: ${item.qrcode || "-"}</span>
        </div>
      </td>
      <td>
        <div class="qty-control-group">
          <button class="btn-qty" onclick="changeItemQty('${item.ean || item.id}', -1)">-</button>
          <span class="qty-val">${item.qty}</span>
          <button class="btn-qty" onclick="changeItemQty('${item.ean || item.id}', 1)">+</button>
        </div>
      </td>
      <td>R$ ${item.preco.toFixed(2).replace(".", ",")}</td>
      <td><strong class="item-subtotal-val">R$ ${itemSubtotal.toFixed(2).replace(".", ",")}</strong></td>
      <td>
        <button class="btn-remove-row" onclick="removeItemFromCart('${item.ean || item.id}')" title="Remover item">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const formattedTotal = `R$ ${total.toFixed(2).replace(".", ",")}`;
  if (totalValueEl) totalValueEl.innerText = formattedTotal;
}

// ============================================================================
// 8. FORMAS DE PAGAMENTO E SIMULAÇÃO DE TRANSAÇÃO
// ============================================================================
function updateCheckoutTotals() {
  const total = calculateCartTotal();
  const formatted = `R$ ${total.toFixed(2).replace(".", ",")}`;
  const checkoutEl = document.getElementById("checkout-total-value");
  if (checkoutEl) checkoutEl.innerText = formatted;
}

function selectPaymentMethod(methodName, iconClass) {
  SessionState.selectedPaymentMethod = methodName;
  const total = calculateCartTotal();
  const formattedTotal = `R$ ${total.toFixed(2).replace(".", ",")}`;

  const modal = document.getElementById("modal-payment-process");
  const modalTitle = document.getElementById("modal-payment-title");
  const modalBody = document.getElementById("modal-payment-body");

  if (!modal || !modalBody) return;

  if (methodName === "PIX") {
    modalTitle.innerHTML = `<i class="fa-brands fa-pix"></i> Pagamento via PIX`;
    modalBody.innerHTML = `
      <div class="pix-qr-container">
        <p style="font-size: 15px; color: #475569;">Abra o app do seu banco e escaneie o código abaixo:</p>
        <div class="pix-qr-box">
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <!-- QR Code ilustrativo SVG ultra nítido -->
            <rect width="100" height="100" fill="#ffffff"/>
            <path d="M10,10 h30 v30 h-30 z M16,16 v18 h18 v-18 z M22,22 h6 v6 h-6 z" fill="#00365a"/>
            <path d="M60,10 h30 v30 h-30 z M66,16 v18 h18 v-18 z M72,22 h6 v6 h-6 z" fill="#00365a"/>
            <path d="M10,60 h30 v30 h-30 z M16,66 v18 h18 v-18 z M22,72 h6 v6 h-6 z" fill="#00365a"/>
            <rect x="46" y="10" width="8" height="8" fill="#32bcad"/>
            <rect x="46" y="24" width="8" height="16" fill="#00365a"/>
            <rect x="10" y="46" width="12" height="8" fill="#32bcad"/>
            <rect x="28" y="46" width="12" height="8" fill="#00365a"/>
            <rect x="46" y="46" width="18" height="18" fill="#32bcad"/>
            <rect x="70" y="46" width="20" height="8" fill="#00365a"/>
            <rect x="46" y="70" width="8" height="20" fill="#00365a"/>
            <rect x="60" y="60" width="14" height="14" fill="#00365a"/>
            <rect x="80" y="70" width="10" height="20" fill="#32bcad"/>
          </svg>
        </div>
        <div style="font-size: 20px; font-weight: 800; color: #00365a;">${formattedTotal}</div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #10b981; font-weight: 600;">
          <i class="fa-solid fa-spinner fa-spin"></i> Aguardando confirmação do banco...
        </div>
      </div>
    `;
  } else {
    modalTitle.innerHTML = `<i class="${iconClass}"></i> ${methodName}`;
    modalBody.innerHTML = `
      <div class="card-tef-animation">
        <i class="fa-solid fa-credit-card card-tef-icon"></i>
        <h4 style="font-size: 18px; color: #00365a;">Aproxime ou insira o cartão</h4>
        <p style="color: #64748b; font-size: 14px;">Siga as instruções na maquininha do totem</p>
        <div style="font-size: 22px; font-weight: 900; color: #00365a;">${formattedTotal}</div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #0098ff; font-weight: 600;">
          <i class="fa-solid fa-spinner fa-spin"></i> Conectando ao terminal TEF...
        </div>
      </div>
    `;
  }

  modal.classList.add("active");

  // Simula o tempo de resposta da adquirente/banco (2.5 segundos)
  setTimeout(() => {
    closePaymentModal();
    finalizeOrder();
  }, 2600);
}

function closePaymentModal() {
  const modal = document.getElementById("modal-payment-process");
  if (modal) modal.classList.remove("active");
}

function finalizeOrder() {
  const total = calculateCartTotal();
  const formattedTotal = `R$ ${total.toFixed(2).replace(".", ",")}`;
  const orderId = `#KNC-${Math.floor(10000 + Math.random() * 90000)}`;

  document.getElementById("receipt-order-id").innerText = orderId;
  document.getElementById("receipt-payment-method").innerText = SessionState.selectedPaymentMethod || "Cartão";
  document.getElementById("receipt-total-value").innerText = formattedTotal;

  const customerCpfRow = document.getElementById("receipt-customer-cpf");
  if (customerCpfRow) {
    customerCpfRow.innerText = SessionState.customer.cpf || "Não Identificado";
  }

  SoundFX.playBeep(2600, "triangle", 0.2);
  goToStep("confirmacao");
}

// ============================================================================
// 9. CONTADOR DE AUTO-RETORNO E INATIVIDADE
// ============================================================================
function startAutoReturnCountdown() {
  clearAutoReturnTimer();
  let remaining = 10;
  const timerEl = document.getElementById("countdown-timer");
  if (timerEl) timerEl.innerText = remaining;

  SessionState.autoReturnTimer = setInterval(() => {
    remaining -= 1;
    if (timerEl) timerEl.innerText = remaining;

    if (remaining <= 0) {
      clearAutoReturnTimer();
      resetAllPurchase();
    }
  }, 1000);
}

function clearAutoReturnTimer() {
  if (SessionState.autoReturnTimer) {
    clearInterval(SessionState.autoReturnTimer);
    SessionState.autoReturnTimer = null;
  }
}

function resetInactivityTimer() {
  if (SessionState.inactivityTimer) {
    clearTimeout(SessionState.inactivityTimer);
  }

  // Se estiver fora da tela inicial, volta para Home após 60 segundos sem toque
  if (SessionState.currentStep !== "home" && SessionState.currentStep !== "confirmacao") {
    SessionState.inactivityTimer = setTimeout(() => {
      resetAllPurchase();
    }, 60000);
  }
}

// Monitora interações touch/clique na tela para renovar o timer de inatividade
["click", "touchstart", "keydown"].forEach(evt => {
  window.addEventListener(evt, () => resetInactivityTimer(), { passive: true });
});

function resetAllPurchase() {
  clearAutoReturnTimer();
  SessionState.cart = [];
  SessionState.customer.isIdentified = false;
  SessionState.customer.cpf = "";
  SessionState.selectedPaymentMethod = "";
  currentCpfRaw = "";
  
  clearCpfInput();
  setCustomerType(true);
  renderCart();
  goToStep("home");
}

// ============================================================================
// 10. PAINEL ADMINISTRATIVO E GESTÃO DO LOCALSTORAGE (MODAL ADMIN)
// ============================================================================
function handleBrandTap() {
  // Toque simples no logo volta para home ou aciona menu
}

function openAdminModal() {
  renderAdminProductsTable();
  resetProductForm();
  const modal = document.getElementById("modal-admin-catalog");
  if (modal) modal.classList.add("active");
}

function closeAdminModal() {
  const modal = document.getElementById("modal-admin-catalog");
  if (modal) modal.classList.remove("active");
}

function renderAdminProductsTable() {
  const tbody = document.getElementById("admin-products-tbody");
  const countEl = document.getElementById("admin-product-count");
  if (!tbody) return;

  const products = StorageManager.getAll();
  if (countEl) countEl.innerText = products.length;

  tbody.innerHTML = "";

  products.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <strong>${p.nome}</strong>
        ${p.descricao ? `<br><small style="color:#64748b;">${p.descricao}</small>` : ""}
      </td>
      <td><code>${p.ean || "-"}</code></td>
      <td><code>${p.qrcode || "-"}</code></td>
      <td><strong>R$ ${p.preco.toFixed(2).replace(".", ",")}</strong></td>
      <td>
        <button type="button" class="btn-admin-action beep" onclick="adminTestBeep('${p.ean}')" title="Testar Bip">
          <i class="fa-solid fa-barcode"></i> Bipar
        </button>
        <button type="button" class="btn-admin-action edit" onclick="adminEditProduct('${p.id}')" title="Editar">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button type="button" class="btn-admin-action delete" onclick="adminDeleteProduct('${p.id}')" title="Excluir">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function adminTestBeep(code) {
  closeAdminModal();
  processScannedCode(code);
}

function adminEditProduct(id) {
  const product = StorageManager.getAll().find(p => p.id === id);
  if (!product) return;

  document.getElementById("prod-form-id").value = product.id;
  document.getElementById("prod-name").value = product.nome;
  document.getElementById("prod-price").value = product.preco;
  document.getElementById("prod-ean").value = product.ean || "";
  document.getElementById("prod-qrcode").value = product.qrcode || "";
  document.getElementById("prod-desc").value = product.descricao || "";
  document.getElementById("prod-category").value = product.categoria || "Bebidas";
  document.getElementById("prod-image").value = product.imagem || "";

  document.getElementById("btn-cancel-edit").style.display = "inline-block";
}

function resetProductForm() {
  const form = document.getElementById("form-product");
  if (form) form.reset();
  document.getElementById("prod-form-id").value = "";
  document.getElementById("btn-cancel-edit").style.display = "none";
}

function handleProductFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("prod-form-id").value || `prod-${Date.now()}`;
  const nome = document.getElementById("prod-name").value.trim();
  const preco = parseFloat(document.getElementById("prod-price").value);
  const ean = document.getElementById("prod-ean").value.trim();
  const qrcode = document.getElementById("prod-qrcode").value.trim();
  const descricao = document.getElementById("prod-desc").value.trim();
  const categoria = document.getElementById("prod-category").value;
  const imagem = document.getElementById("prod-image").value.trim();

  if (!nome || isNaN(preco) || !ean) {
    alert("Preencha ao menos Nome, Preço e Código EAN.");
    return;
  }

  StorageManager.upsert({
    id,
    nome,
    preco,
    ean,
    qrcode: qrcode || `KNC-${ean}`,
    descricao,
    categoria,
    imagem
  });

  resetProductForm();
}

function adminDeleteProduct(id) {
  if (confirm("Tem certeza que deseja remover este produto do LocalStorage?")) {
    StorageManager.deleteById(id);
  }
}

function confirmResetDefaultCatalog() {
  if (confirm("Deseja restaurar o catálogo de fábrica? Quaisquer produtos adicionados manualmente serão redefinidos.")) {
    StorageManager.resetToDefault();
  }
}

function generateRandomEan() {
  const randomEan = "789" + Math.floor(1000000000 + Math.random() * 9000000000);
  document.getElementById("prod-ean").value = randomEan;
}

function generateRandomQrCode() {
  const randomQr = "KNC-PROD-" + Math.floor(100 + Math.random() * 900);
  document.getElementById("prod-qrcode").value = randomQr;
}

// ============================================================================
// 11. INICIALIZAÇÃO DA APLICAÇÃO
// ============================================================================
window.addEventListener("DOMContentLoaded", () => {
  StorageManager.init();
  SoundFX.init();
  renderShelfDemoProducts();
  renderCart();
  setCustomerType(true);

  // Inicializa o player de vídeo
  const video = document.getElementById("home-video-player");
  if (video) {
    video.play().catch(e => {
      console.log("Autoplay aguardando primeira interação do usuário.");
    });
  }

  console.log("PDV Totem 27\" KNC Brasil inicializado com sucesso!");
});