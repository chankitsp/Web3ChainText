document.addEventListener('DOMContentLoaded', () => {
    const writeForm = document.getElementById('writeForm');
    const readForm = document.getElementById('readForm');
    const resultDiv = document.getElementById('result');

    function showResult(message, isError = false) {
        resultDiv.style.display = 'block';
        resultDiv.textContent = message;
        resultDiv.className = `result ${isError ? 'error' : 'success'}`;
    }

    if (writeForm) {
        writeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const message = document.getElementById('message').value;
            const password = document.getElementById('password').value;
            const submitBtn = writeForm.querySelector('button');

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Encrypting & Sending...';
                resultDiv.style.display = 'none';

                const response = await fetch('/api/write', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message, password })
                });

                const data = await response.json();

                if (data.success) {
                    showResult(`Success! TXID: ${data.txHash}`);
                } else {
                    showResult(`Error: ${data.error}`, true);
                }
            } catch (err) {
                showResult(`Network Error: ${err.message}`, true);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Write to Chain';
            }
        });
    }

    if (readForm) {
        readForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const txHash = document.getElementById('txHash').value;
            const password = document.getElementById('password').value;
            const submitBtn = readForm.querySelector('button');

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Fetching & Decrypting...';
                resultDiv.style.display = 'none';

                const response = await fetch('/api/read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ txHash, password })
                });

                const data = await response.json();

                if (data.success) {
                    showResult(`Decrypted Message: ${data.message}`);
                } else {
                    showResult(`Error: ${data.error}`, true);
                }
            } catch (err) {
                showResult(`Network Error: ${err.message}`, true);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Read Message';
            }
        });
    }
});
