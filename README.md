# AM Finance - Sistema de Gestão Inteligente

Este é um sistema de gestão financeira profissional construído com Next.js 15, Firebase e Genkit (IA).

## 🚀 Como publicar o site (Deploy)

Siga estes passos exatos no terminal para enviar seu código para o GitHub:

1. **Vincular o repositório**:
   ```bash
   git remote add origin https://github.com/akiracaio1/am-finance.git
   ```

2. **Renomear a branch principal**:
   ```bash
   git branch -M main
   ```

3. **Enviar o código**:
   ```bash
   git push -u origin main
   ```

4. **Firebase Console**:
   - Após o "push" acima, vá em [App Hosting](https://console.firebase.google.com/project/_/apphosting).
   - Clique em "Começar".
   - Conecte seu repositório `am-finance`.
   - Selecione a região `us-central1`.
   - O Firebase gerará automaticamente sua URL pública.

## 🛠 Tecnologias
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, ShadCN UI.
- **Backend**: Firebase Auth & Firestore.
- **IA**: Genkit com Google Gemini para análise de dados.

## 📋 Funcionalidades
- Fluxo de Caixa Diário e Planejamento.
- Contas a Pagar/Receber com multi-filtros e multi-seleção.
- Importação inteligente de planilhas (Tratamento robusto de datas).
- Conciliação Bancária.
- Relatórios estratégicos com Insights de IA.
