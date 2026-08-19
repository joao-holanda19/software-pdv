// Base de dados inicial (caso bipe algum desses específicos)
const PRODUCTS_DB = {
  "7894900011517": { name: "Coca-Cola Zero", price: 7.00 },
  "7891000100103": { name: "Nescau", price: 11.00 },
  "7896052600014": { name: "Guaraná Jesus", price: 9.00 }
};

let cart = [];
let barcodeBuffer = "";
let lastKeyTime = Date.now();

// Navegação entre as telas
function goToStep(stepName) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });
  const target = document.getElementById(`step-${stepName}`);
  if (target) {
    target.classList.add("active");
  }
}

// Máscara de CPF
function maskCPF(input) {
  let v = input.value.replace(/\D/g, "");
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d)/, "$1.$2");
  v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  input.value = v;
}

function selectCpfOption(isCpf) {
  document.getElementById("card-sim").classList.toggle("selected", isCpf);
  document.getElementById("card-nao").classList.toggle("selected", !isCpf);
}

// Adicionar produto ao carrinho (gera nome e preço aleatório se não cadastrado)
function addProduct(barcode) {
  let item = PRODUCTS_DB[barcode];

  if (!item) {
    // Gera um preço aleatório entre R$ 4,50 e R$ 29,90 com 2 casas decimais
    const randomPrice = parseFloat((Math.random() * (29.90 - 4.50) + 4.50).toFixed(2));

    item = {
      name: `Produto (${barcode})`,
      price: randomPrice
    };
  }

  const existing = cart.find(p => p.barcode === barcode);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...item, barcode, qty: 1 });
  }

  renderCart();
  goToStep("carrinho");
}

// Renderizar carrinho e totalizadores
function renderCart() {
  const tbody = document.getElementById("cart-items");
  if (!tbody) return;
  tbody.innerHTML = "";
  let total = 0;

  cart.forEach(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.qty}</td>
      <td>R$ ${item.price.toFixed(2).replace(".", ",")}</td>
      <td>R$ ${itemTotal.toFixed(2).replace(".", ",")}</td>
    `;
    tbody.appendChild(tr);
  });

  const formattedTotal = `R$ ${total.toFixed(2).replace(".", ",")}`;
  document.getElementById("cart-total-value").innerText = formattedTotal;
  document.getElementById("checkout-total-value").innerText = formattedTotal;
}

// Finalizar pagamento
function finishPayment(method) {
  goToStep("confirmacao");
}

// Resetar compra
function resetAll() {
  cart = [];
  const cpfInput = document.getElementById("cpf-input");
  if (cpfInput) cpfInput.value = "";
  renderCart();
  goToStep("home");
}

// Captura automática de leitura do leitor físico USB / teclado
window.addEventListener("keydown", (e) => {
  // Ignora captura do scanner se o usuário estiver digitando no campo de CPF
  if (document.activeElement && document.activeElement.id === "cpf-input") {
    return;
  }

  const currentTime = Date.now();

  // Leitores de código de barras enviam os dígitos em alta velocidade (< 50ms entre teclas)
  if (currentTime - lastKeyTime > 100) {
    barcodeBuffer = "";
  }
  lastKeyTime = currentTime;

  if (e.key === "Enter") {
    if (barcodeBuffer.trim().length > 0) {
      addProduct(barcodeBuffer.trim());
      barcodeBuffer = "";
    }
  } else if (e.key.length === 1) {
    barcodeBuffer += e.key;
  }
});