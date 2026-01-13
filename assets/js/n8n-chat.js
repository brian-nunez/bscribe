document.addEventListener('DOMContentLoaded', () => {
  const n8nChat = {
    webhookUrl: "https://automation.b8z.me/webhook/18d28780-9c92-40e8-8a6c-311ee8892176/chat",
    sessionId: null,

    init: function() {
      this.createChatElements();
      this.addEventListeners();
      this.loadSession();
      this.addMessage("Hello! How can I help you today?", 'bot');
    },

    loadSession: function() {
      let sessionId = sessionStorage.getItem('n8nChatSessionId');
      if (!sessionId) {
        sessionId = this.generateUUID();
        sessionStorage.setItem('n8nChatSessionId', sessionId);
      }
      this.sessionId = sessionId;
    },

    generateUUID: function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },

    createChatElements: function() {
      const style = document.createElement('style');
      style.textContent = `
        .n8n-chat-widget {
          position: fixed;
          bottom: 25px;
          right: 25px;
          width: 65px;
          height: 65px;
          background-color: #007bff; /* Brighter, more noticeable color */
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          z-index: 9999;
          animation: n8n-chat-pulse 2s infinite; /* Add pulse animation */
        }
        .n8n-chat-widget:hover {
          transform: scale(1.1);
          animation-play-state: paused; /* Pause animation on hover */
        }
        .n8n-chat-icon {
          width: 32px; /* Icon size */
          height: 32px;
        }
        .n8n-chat-container {
          position: fixed;
          bottom: 100px;
          right: 20px;
          width: 350px;
          height: 500px;
          background-color: white;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          display: none;
          flex-direction: column;
          overflow: hidden;
          z-index: 10000;
        }
        .n8n-chat-header {
          background-color: #f1f1f1;
          padding: 15px;
          font-weight: bold;
          border-bottom: 1px solid #e0e0e0;
        }
        .n8n-chat-messages {
          flex-grow: 1;
          padding: 15px;
          overflow-y: auto;
        }
        .n8n-chat-input-form {
          display: flex;
          border-top: 1px solid #e0e0e0;
        }
        .n8n-chat-input {
          flex-grow: 1;
          border: none;
          padding: 15px;
          outline: none;
        }
        .n8n-chat-send-btn {
          background-color: #1a1a1a;
          color: white;
          border: none;
          padding: 0 20px;
          cursor: pointer;
        }
        /* Thinking animation styles */
        .n8n-chat-thinking-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          background-color: #888;
          border-radius: 50%;
          margin: 0 2px;
          animation: n8n-chat-blink 1.4s infinite both;
        }
        .n8n-chat-thinking-dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        .n8n-chat-thinking-dot:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes n8n-chat-blink {
          0% { opacity: 0.2; }
          20% { opacity: 1; }
          100% { opacity: 0.2; }
        }
        /* Pulse animation for the widget */
        @keyframes n8n-chat-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.7);
          }
          70% {
            box-shadow: 0 0 0 15px rgba(0, 123, 255, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(0, 123, 255, 0);
          }
        }
      `;
      document.head.appendChild(style);

      const chatWidget = document.createElement('div');
      chatWidget.className = 'n8n-chat-widget';
      chatWidget.innerHTML = `
        <svg class="n8n-chat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
          <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/>
        </svg>
      `;
      
      const chatContainer = document.createElement('div');
      chatContainer.className = 'n8n-chat-container';
      chatContainer.innerHTML = `
        <div class="n8n-chat-header">AI Assistant</div>
        <div class="n8n-chat-messages"></div>
        <form class="n8n-chat-input-form">
          <input type="text" class="n8n-chat-input" placeholder="Ask something...">
          <button type="submit" class="n8n-chat-send-btn">Send</button>
        </form>
      `;

      document.body.appendChild(chatWidget);
      document.body.appendChild(chatContainer);
    },

    addEventListeners: function() {
      const widget = document.querySelector('.n8n-chat-widget');
      const container = document.querySelector('.n8n-chat-container');
      const form = document.querySelector('.n8n-chat-input-form');

      widget.addEventListener('click', () => {
        container.style.display = container.style.display === 'flex' ? 'none' : 'flex';
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.querySelector('.n8n-chat-input');
        const message = input.value.trim();
        if (message) {
          this.addMessage(message, 'user');
          this.sendMessageToWebhook(message);
          input.value = '';
        }
      });
    },

    addMessage: function(text, sender) {
      const messagesContainer = document.querySelector('.n8n-chat-messages');
      const messageElement = document.createElement('div');
      messageElement.style.marginBottom = '10px';
      messageElement.style.textAlign = sender === 'user' ? 'right' : 'left';
      
      const bubble = document.createElement('div');
      bubble.textContent = text;
      bubble.style.display = 'inline-block';
      bubble.style.padding = '10px 15px';
      bubble.style.borderRadius = '18px';
      bubble.style.backgroundColor = sender === 'user' ? '#1a1a1a' : '#f1f1f1';
      bubble.style.color = sender === 'user' ? 'white' : 'black';
      
      messageElement.appendChild(bubble);
      messagesContainer.appendChild(messageElement);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },

    showThinkingIndicator: function() {
      const messagesContainer = document.querySelector('.n8n-chat-messages');
      const thinkingElement = document.createElement('div');
      thinkingElement.id = 'n8n-chat-thinking-indicator';
      thinkingElement.style.marginBottom = '10px';
      
      const bubble = document.createElement('div');
      bubble.style.display = 'inline-block';
      bubble.style.padding = '10px 15px';
      bubble.style.borderRadius = '18px';
      bubble.style.backgroundColor = '#f1f1f1';
      bubble.innerHTML = `
        <div class="n8n-chat-thinking-dot"></div>
        <div class="n8n-chat-thinking-dot"></div>
        <div class="n8n-chat-thinking-dot"></div>
      `;
      
      thinkingElement.appendChild(bubble);
      messagesContainer.appendChild(thinkingElement);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },

    removeThinkingIndicator: function() {
      const indicator = document.getElementById('n8n-chat-thinking-indicator');
      if (indicator) {
        indicator.remove();
      }
    },

    sendMessageToWebhook: function(message) {
      this.showThinkingIndicator();

      fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          chatInput: message,
          sessionId: this.sessionId 
        }),
      })
      .then(response => response.json())
      .then(data => {
        this.removeThinkingIndicator();
        if (data && data.output) {
          this.addMessage(data.output, 'bot');
        }
      })
      .catch(error => {
        this.removeThinkingIndicator();
        console.error('Error sending message to n8n:', error);
        this.addMessage('Sorry, I seem to be having trouble connecting.', 'bot');
      });
    }
  };

  n8nChat.init();
});
