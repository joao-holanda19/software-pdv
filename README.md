# Totem PDV de Autoatendimento 27" (1080x1920) | KNC Brasil

Sistema web desenvolvido para totens de autoatendimento touch-screen verticais (proporção 9:16 / 1080x1920) da **KNC Brasil**.

---

## 🚀 Funcionalidades

- **Tela Inicial com Vídeo em Loop**: Estrutura de vídeo em background contínuo (`assets/video-loop.mp4`) com fallback dinâmico animado e chamada tátil para início da compra.
- **Catálogo de Produtos em LocalStorage**:
  - Campos completos: **Nome do Produto**, **Descrição**, **EAN (Código de Barras)**, **QR Code**, **Preço**, **Categoria** e **Imagem**.
  - Persistência contínua e gerenciamento em tempo real.
- **Leitor de Código de Barras & QR Code**:
  - Captura contínua de leitor físico USB/Laser via teclado em alta velocidade.
  - Suporte à busca tanto pelo EAN-13 quanto por QR Code.
  - Síntese de áudio instantânea (efeito sonoro de bip).
  - Prateleira de simulação rápida para testes na tela de scanner.
- **Identificação do Cliente com Teclado Touch**:
  - Teclado numérico virtual integrado na tela (Touch Keypad) para digitação do CPF em telas de 27".
  - Suporte concomitante a teclado físico.
- **Carrinho de Compras Interativo**:
  - Controle de quantidades (+/-), exclusão de itens e cálculo em tempo real de subtotais e total geral formatado em BRL.
- **Pagamentos & Confirmação**:
  - Formas de pagamento: Débito, Crédito, PIX (com QR Code simulado em SVG) e Alimentação/Refeição.
  - Tela de confirmação com temporizador de 10s para auto-retorno à Home e proteção contra abandono (inactivity timeout).
- **Painel de Gestão (Modo Gerente/Admin)**:
  - Atalho de teclado: `Ctrl + Shift + P` ou botão discreto no rodapé da Home.
  - Permite cadastrar, editar, excluir, restaurar catálogo de fábrica e testar bipagem de qualquer item.

---

## 📁 Estrutura de Arquivos

```
software-pdv-main/
├── assets/
│   ├── README.md               # Instruções sobre o vídeo de loop e imagens
│   └── video-loop.mp4          # (Coloque aqui o arquivo de vídeo institucional)
├── index.html                  # Estrutura semântica e telas do fluxo
├── style.css                   # Design system KNC, layout 9:16 (1080x1920)
├── script.js                   # Lógica central, LocalStorage, Scanner e Carrinho
└── README.md                   # Documentação do projeto
```

---

## ⚙️ Como Executar

Basta abrir o arquivo `index.html` em qualquer navegador web moderno. Para modo totem de tela cheia, pressione `F11` ou utilize o Chromium em modo Kiosk (`--kiosk --kiosk-printing`).
