document.addEventListener('touchstart', function(event) {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
}, { passive: false });
document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
});



fetch('/validate-user', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ data: window.Telegram.WebApp})
})
.then(response => {
    if (response.redirected) {
        window.location.href = response.url;
        return;
    }
})
.catch(error => {
});


Telegram.WebApp.ready();
Telegram.WebApp.expand();