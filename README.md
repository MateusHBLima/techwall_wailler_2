# Casa Protótipo

Manual de montagem interativo 3D para a Casa Protótipo da Tech Wall.

## 🚀 Deploy no Vercel

### Opção 1: Deploy via CLI

1. Instale o Vercel CLI:
```bash
npm install -g vercel
```

2. Na pasta do projeto, execute:
```bash
vercel
```

3. Siga as instruções:
   - Login com sua conta Vercel
   - Confirme as configurações do projeto
   - Deploy será feito automaticamente

### Opção 2: Deploy via GitHub

1. Faça push do projeto para um repositório GitHub
2. Acesse [vercel.com](https://vercel.com)
3. Clique em "Import Project"
4. Selecione seu repositório
5. Vercel detectará automaticamente o Vite
6. Clique em "Deploy"

## 🛠️ Desenvolvimento Local

```bash
npm install
npm run dev
```

Acesse: `http://localhost:5173`

## 📦 Build de Produção

```bash
npm run build
npm run preview
```

## ✨ Funcionalidades

- 🏠 Visualização 3D interativa da casa
- 📋 Modo de visão geral com inventário dinâmico
- 🔨 Modo de montagem passo a passo
- 👻 Estilo "Blueprint Ghost" para peças futuras
- 📊 Contadores de progresso em tempo real
- 🎥 Câmera com foco automático e controle bloqueado durante montagem
- 💾 Preservação de progresso ao alternar entre modos

## 🎨 Tecnologias

- **Three.js** - Renderização 3D
- **Vite** - Build tool
- **Vanilla JavaScript** - Lógica da aplicação
