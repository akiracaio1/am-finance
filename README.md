# AM Finance - Sistema de Gestão Inteligente

Este é um sistema de gestão financeira profissional construído com Next.js 15, Firebase e Genkit (IA).

## 🚀 Como publicar o site (Deploy) - Passo a Passo Final

### 1. Enviar para o GitHub
Se ainda não fez, rode estes comandos no terminal:
```bash
git init
git add .
git commit -m "primeiro deploy am-finance"
git remote add origin https://github.com/akiracaio1/am-finance.git
git branch -M main
git push -u origin main
```

### 2. Configurar no Firebase Console
Vá em [App Hosting](https://console.firebase.google.com/project/_/apphosting) e preencha assim:

- **Região**: `us-central1 (Iowa)`
- **Repositório**: Selecione `am-finance`
- **Ramificação ativa**: Escolha `main`
- **Diretório raiz**: Deixe `/`
- **Nome do Back-end**: `am-finance-prod`
- **App Web**: Selecione o seu app da lista (ID: studio-1144...)

### 3. Aguarde o link
Após clicar em "Finalizar", o Firebase levará cerca de 3 a 5 minutos para processar tudo. Quando terminar, ele exibirá o seu **Domínio do App Hosting**. Esse é o seu link oficial!

## 🛠 Tecnologias
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, ShadCN UI.
- **Backend**: Firebase Auth & Firestore.
- **IA**: Genkit com Google Gemini para análise de dados.
