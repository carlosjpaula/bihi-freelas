document.addEventListener('DOMContentLoaded', () => {
    // 1. Identificar o tipo (staff ou entregador)
    const urlParams = new URLSearchParams(window.location.search);
    const tipoStr = urlParams.get('tipo');
    const tipo = (tipoStr && tipoStr.toLowerCase() === 'entregador') ? 'entregador' : 'staff';

    // Atualizar UI com o tipo
    document.getElementById('page-title').innerText = `Cadastro - ${tipo === 'staff' ? 'Staff' : 'Entregador'}`;
    document.getElementById('contract-text').innerText = contratos[tipo];

    // 2. Lógica do MEI
    const selectMei = document.getElementById('tem-mei');
    const cnpjGroup = document.getElementById('cnpj-group');
    const inputCnpj = document.getElementById('cnpj');

    selectMei.addEventListener('change', (e) => {
        if (e.target.value === 'sim') {
            cnpjGroup.classList.remove('hidden');
            inputCnpj.setAttribute('required', 'true');
        } else {
            cnpjGroup.classList.add('hidden');
            inputCnpj.removeAttribute('required');
            inputCnpj.value = '';
        }
    });

    // 3. Lógica da Câmera e Geolocalização
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('photo-canvas');
    const btnStartCamera = document.getElementById('btn-start-camera');
    const btnTakePhoto = document.getElementById('btn-take-photo');
    const locationDataEl = document.getElementById('location-data');
    
    let photoDataUrl = null;
    let userLocation = null;
    let stream = null;

    btnStartCamera.addEventListener('click', async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            video.srcObject = stream;
            btnStartCamera.classList.add('hidden');
            btnTakePhoto.classList.remove('hidden');
        } catch (err) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                video.srcObject = stream;
                btnStartCamera.classList.add('hidden');
                btnTakePhoto.classList.remove('hidden');
            } catch (err2) {
                alert('Erro ao acessar a câmera: Por favor, dê permissão no seu navegador.');
            }
        }
    });

    btnTakePhoto.addEventListener('click', () => {
        // Tirar a foto
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        photoDataUrl = canvas.toDataURL('image/png');
        
        // Esconder vídeo, mostrar canvas
        video.classList.add('hidden');
        canvas.classList.remove('hidden');
        btnTakePhoto.classList.add('hidden');

        // Parar a câmera
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        // Pegar localização
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    locationDataEl.classList.remove('hidden');
                    locationDataEl.innerText = `📍 Localização capturada: Lat ${userLocation.lat.toFixed(4)}, Lng ${userLocation.lng.toFixed(4)}`;
                },
                (err) => {
                    alert('Erro ao capturar localização. Por favor, permita o acesso à localização.');
                    locationDataEl.classList.remove('hidden');
                    locationDataEl.style.color = '#ef4444';
                    locationDataEl.innerText = '❌ Localização não capturada.';
                }
            );
        } else {
            alert('Geolocalização não suportada neste navegador.');
        }
    });

    // 4. Lógica da Assinatura
    const signatureCanvas = document.getElementById('signature-pad');
    
    // Ajustar o canvas para alta resolução
    function resizeCanvas() {
        const ratio =  Math.max(window.devicePixelRatio || 1, 1);
        signatureCanvas.width = signatureCanvas.offsetWidth * ratio;
        signatureCanvas.height = signatureCanvas.offsetHeight * ratio;
        signatureCanvas.getContext("2d").scale(ratio, ratio);
    }
    
    // Removido o event listener de resize para não apagar a assinatura no mobile ao abrir teclado
    setTimeout(() => {
        resizeCanvas();
        signaturePad.clear();
    }, 100);

    const signaturePad = new SignaturePad(signatureCanvas, {
        backgroundColor: 'rgba(255, 255, 255, 1)',
        penColor: 'rgb(0, 0, 0)'
    });

    document.getElementById('btn-clear-signature').addEventListener('click', () => {
        signaturePad.clear();
    });

    // 5. Submissão e Geração de PDF
    const form = document.getElementById('cadastro-form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!photoDataUrl) {
            alert('Por favor, tire uma foto para o cadastro.');
            return;
        }

        if (signaturePad.isEmpty()) {
            alert('Por favor, assine o contrato.');
            return;
        }

        if (!userLocation) {
            const confirmar = confirm('A localização não foi capturada. Deseja continuar mesmo assim?');
            if (!confirmar) return;
        }

        // Coletar dados
        const dados = {
            nome: document.getElementById('nome').value,
            cpf: document.getElementById('cpf').value,
            pix: document.getElementById('pix').value,
            mei: document.getElementById('tem-mei').value === 'sim',
            cnpj: document.getElementById('cnpj').value,
            tipo: tipo,
            dataHora: new Date().toLocaleString('pt-BR')
        };

        const signatureDataUrl = signaturePad.toDataURL();

        // Montar o HTML do PDF com fontes melhores e equilíbrio de espaço
        const pdfTemplate = document.getElementById('contract-preview');
        
        pdfTemplate.innerHTML = `
            <div style="padding: 15px 30px; font-family: Arial, sans-serif; color: #000; background-color: #fff; line-height: 1.3;">
                <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
                    <h2 style="margin: 0; font-size: 1.2rem; text-transform: uppercase;">BIHAI RESTAURANTE LTDA</h2>
                    <p style="margin: 5px 0; font-size: 0.95rem;"><strong>CNPJ:</strong> 53.074.756/0001-41</p>
                    <p style="margin: 2px 0; font-size: 0.75rem; color: #333;">AV. ENGENHEIRO ROBERTO FREIRE, 340, LOJA 64 COND SHOPPING CIDADE JARD, NATAL/RN</p>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <h3 style="background: #f0f0f0; padding: 5px 10px; font-size: 1rem; border-left: 4px solid #000; margin: 0 0 8px 0;">DADOS DO CONTRATADO</h3>
                    <p style="margin: 4px 0; font-size: 0.95rem;"><strong>Nome:</strong> ${dados.nome.toUpperCase()}</p>
                    <p style="margin: 4px 0; font-size: 0.95rem;"><strong>CPF:</strong> ${dados.cpf} | <strong>PIX:</strong> ${dados.pix}</p>
                    ${dados.mei ? `<p style="margin: 4px 0; font-size: 0.95rem;"><strong>CNPJ MEI:</strong> ${dados.cnpj}</p>` : ''}
                </div>

                <div style="margin-bottom: 12px; border: 1px solid #ddd; padding: 10px; border-radius: 6px; background-color: #fcfcfc;">
                    <table style="width: 100%;">
                        <tr>
                            <td style="width: 100px; vertical-align: top;">
                                <img src="${photoDataUrl}" style="width: 90px; height: 90px; object-fit: cover; border: 1px solid #ccc;" />
                            </td>
                            <td style="padding-left: 20px; vertical-align: top;">
                                <p style="margin: 0 0 5px 0; font-size: 0.8rem; font-weight: bold; color: #555;">REGISTRO DE ATIVIDADE</p>
                                <p style="margin: 3px 0; font-size: 0.9rem;"><strong>Data e Hora:</strong> ${dados.dataHora}</p>
                                <p style="margin: 3px 0; font-size: 0.9rem;"><strong>GPS:</strong> ${userLocation ? `Lat ${userLocation.lat.toFixed(5)}, Lng ${userLocation.lng.toFixed(5)}` : 'Indisponível em ambiente local'}</p>
                                <p style="margin: 8px 0 0 0; font-size: 0.75rem; color: #888;">Registro biométrico facial e assinatura eletrônica vinculados.</p>
                            </td>
                        </tr>
                    </table>
                </div>

                <div style="margin-bottom: 15px;">
                    <h3 style="background: #f0f0f0; padding: 5px 10px; font-size: 1rem; border-left: 4px solid #000; margin: 0 0 8px 0;">TERMOS DO CONTRATO - ${tipo.toUpperCase()}</h3>
                    <div style="font-size: 9px; line-height: 1.4; color: #111; text-align: justify; white-space: pre-wrap;">${contratos[tipo]}</div>
                </div>

                <div style="text-align: center; margin-top: 25px; border-top: 1px solid #000; display: block; width: 250px; margin-left: auto; margin-right: auto; padding-top: 5px;">
                    <img src="${signatureDataUrl}" style="max-height: 65px; margin-bottom: -15px;" />
                    <p style="margin: 15px 0 0 0; font-size: 1.05rem; text-transform: uppercase;"><strong>${dados.nome}</strong></p>
                    <p style="font-size: 0.7rem; color: #666; margin: 0;">ASSINATURA DIGITAL</p>
                </div>
                
                <div style="margin-top: 15px; text-align: center; font-size: 9px; color: #999;">
                    Este contrato possui validade jurídica conforme MP 2.200-2/2001 e Código Civil.<br>
                    BIHAI RESTAURANTE LTDA | NATAL/RN
                </div>
            </div>
        `;

        // Gerar o PDF
        const formCard = document.getElementById('form-card');
        const btnSubmit = document.getElementById('btn-submit');
        
        btnSubmit.innerText = 'Gerando Contrato...';
        btnSubmit.disabled = true;

        const opt = {
            margin:       15, // Aumentado para 15mm de margem em todos os lados
            filename:     `Contrato_${tipo}_${dados.nome.replace(/\s+/g, '_')}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, scrollY: 0 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Mostrar div temporariamente para renderizar (importante para o html2pdf capturar)
        const pdfWrapper = document.getElementById('pdf-template');
        pdfWrapper.classList.remove('hidden');
        pdfWrapper.style.position = 'fixed';
        pdfWrapper.style.left = '-9999px'; // Joga para fora da tela mas mantém "visível" para o render
        pdfWrapper.style.top = '0';
        pdfWrapper.style.width = '800px';
        pdfWrapper.style.display = 'block';

        try {
            // Pequeno delay para garantir que o navegador renderizou as imagens (selfie e assinatura)
            await new Promise(resolve => setTimeout(resolve, 500));

            // Gerar o PDF
            const worker = html2pdf().set(opt).from(pdfTemplate);
            const pdfBase64String = await worker.output('datauristring');
            const base64Data = pdfBase64String.split(',')[1];

            btnSubmit.innerText = 'Enviando para o Sistema...';
            
            const payload = {
                nome: dados.nome,
                cpf: dados.cpf,
                tipo: dados.tipo,
                pix: dados.pix,
                mei: dados.mei,
                cnpj: dados.cnpj,
                dataHora: dados.dataHora,
                pdfBase64: base64Data,
                photoBase64: photoDataUrl
            };

            const GOOGLE_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzFcDpQrMWSZLP-J07L7_QNnYFfesCQ2G5CIjQzSEdDLHQ3WyYcUiaXqU-n7m2Y9HFB/exec';

            // Enviar os dados via POST para a planilha
            await fetch(GOOGLE_WEBAPP_URL, {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(payload)
            });

            // Removemos o download automático oculto porque os celulares bloqueiam por segurança.
            // Vamos adicionar um botão de download explícito na tela de sucesso.
            
            // Sucesso
            formCard.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <h2 style="color: #10b981; margin-bottom: 1rem;">✅ Cadastro Concluído!</h2>
                    <p>Seus dados foram registrados com sucesso no BIHI RESTAURANTE.</p>
                    <p style="margin-top: 1rem; margin-bottom: 2rem; color: var(--text-muted);">Baixe a sua cópia oficial do contrato abaixo:</p>
                    
                    <a href="${pdfBase64String}" download="${opt.filename}" class="btn" style="display: block; background-color: #3b82f6; text-decoration: none; padding: 1rem; margin-bottom: 1rem; color: white; font-weight: bold; border-radius: 8px;">⬇️ Baixar Minha Cópia (PDF)</a>
                    
                    <button onclick="window.location.href='index.html'" class="btn-secondary" style="width: 100%; padding: 1rem; border-radius: 8px; background: transparent; color: white; border: 1px solid #555; cursor: pointer;">Finalizar e Voltar</button>
                </div>
            `;
        } catch (error) {
            alert('Erro ao gerar o PDF. Tente novamente.');
            btnSubmit.innerText = 'Finalizar e Gerar Contrato';
            btnSubmit.disabled = false;
        } finally {
            pdfWrapper.classList.add('hidden');
            pdfWrapper.style.position = '';
            pdfWrapper.style.left = '';
            pdfWrapper.style.width = '';
        }
    });
});
