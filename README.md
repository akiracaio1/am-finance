# AM Finance - Sistema de Gestão Inteligente

Este é um sistema de gestão financeira profissional construído com Next.js 15, Firebase e Genkit (IA).

## 🚀 Como publicar o site (Deploy)

Siga estes passos exatos no terminal do editor para enviar seu código para o GitHub:

1. **Inicializar o Git**:
   ```bash
   git init
   ```

2. **Preparar os arquivos**:
   ```bash
   git add .
   ```

3. **Criar o primeiro registro**:
   ```bash
   git commit -m "primeiro deploy am-finance"
   ```

4. **Vincular ao seu repositório**:
   ```bash
   git remote add origin https://github.com/akiracaio1/am-finance.git
   ```

5. **Renomear a branch principal**:
   ```bash
   git branch -M main
   ```

6. **Enviar o código**:
   ```bash
   git push -u origin main
   ```

## 🌐 Próximo Passo: Firebase Console
- Após o "push" acima, vá em [App Hosting](https://console.firebase.google.com/project/_/apphosting).
- Clique em "Começar" ou "Adicionar Back-end".
- Selecione o repositório `am-finance` que agora estará com o código.
- Siga as instruções de região (`us-central1`) e o Firebase gerará sua URL pública.

## 🛠 Tecnologias
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, ShadCN UI.
- **Backend**: Firebase Auth & Firestore.
- **IA**: Genkit com Google Gemini para análise de dados.
