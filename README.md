# AM Finance - Sistema de Gestão Inteligente

Este é um sistema de gestão financeira profissional construído com Next.js 15, Firebase e Genkit (IA).

## 🚀 Como publicar o site (Deploy) - Passo a Passo Final

### 1. Enviar para o GitHub
No terminal do Studio, rode estes comandos:
```bash
git init
git add .
git commit -m "primeiro deploy am-finance"
git remote add origin https://github.com/akiracaio1/am-finance.git
git branch -M main
git push -u origin main
```

### 2. Configurar no Firebase Console
Vá em [App Hosting](https://console.firebase.google.com/project/_/apphosting) e preencha:

- **Passo 1 (Região)**: Escolha `us-central1 (Iowa)`
- **Passo 2 (Repositório)**: Selecione `am-finance` e a ramificação `main`.
- **Passo 3 (Configurações)**: Deixe o diretório raiz como `/`.
- **Passo 4 (Configurar Back-end)**: 
  - ID: `am-finance-backend`
  - **Variáveis de Ambiente**: Clique em "Adicionar chave". 
    - Chave: `GEMINI_API_KEY` 
    - Valor: Sua chave do Gemini (obtida no Google AI Studio).
- **Passo 5 (Associar App)**: Selecione o seu app Web da lista.

### 3. Aguarde o link
Após clicar em "Finalizar", o Firebase levará cerca de 3 a 5 minutos. O link oficial aparecerá na tela do App Hosting!

## 🛠 Tecnologias
- **IA**: Genkit com Google Gemini (Requer `GEMINI_API_KEY`).
- **Frontend**: Next.js 15, Tailwind, ShadCN.
- **Backend**: Firebase Auth & Firestore.
