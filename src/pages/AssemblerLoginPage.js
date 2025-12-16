
export class AssemblerLoginPage {
    constructor(container) {
        this.container = container;
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#1a1a1a; color:#fff; text-align:center;">
                <h1 style="color:#007acc; font-size:2rem; margin-bottom:10px;">Acesso do Montador</h1>
                <p style="margin-bottom:30px; color:#aaa;">Insira o código do projeto para visualizar a montagem.</p>
                
                <div style="display:flex; gap:10px;">
                    <input type="text" id="project-code" placeholder="Código (ex: A1B2C3)" 
                        style="padding:10px; font-size:1.2rem; text-transform:uppercase; text-align:center; width:200px; border-radius:4px; border:1px solid #444; background:#222; color:white;">
                    <button id="btn-enter" class="btn-primary" style="font-size:1.2rem;">Entrar</button>
                </div>
                <p id="error-msg" style="color:red; margin-top:20px; display:none;">Projeto não encontrado</p>
                <br>
                <a href="#" style="color:#555; text-decoration:none; font-size:0.8rem;">Voltar para Admin</a>
            </div>
        `;

        const input = this.container.querySelector('#project-code');
        const btn = this.container.querySelector('#btn-enter');
        const errorMsg = this.container.querySelector('#error-msg');

        const submit = () => {
            const code = input.value.trim().toUpperCase();
            if (!code) return;

            // Simple validation or check existance logic could go here, 
            // but for routing we just redirect and let the Viewer handle 404
            window.location.hash = `assembler/${code}`;
        };

        btn.onclick = submit;
        input.onkeypress = (e) => {
            if (e.key === 'Enter') submit();
        };
    }

    destroy() {
        this.container.innerHTML = '';
    }
}
