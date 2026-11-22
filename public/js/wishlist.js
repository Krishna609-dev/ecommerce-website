document.addEventListener('click', async function (event) {
    const button = event.target.closest('.wishlist-btn');

    if (!button || button.disabled) return;

    event.preventDefault();

    const productId = button.dataset.productId;
    const isWishlisted = button.dataset.wishlisted === 'true';
    const url = isWishlisted
        ? `/wishlist/remove/${encodeURIComponent(productId)}`
        : `/wishlist/add/${encodeURIComponent(productId)}`;

    button.disabled = true;

    try {
        const response = await fetch(url, {
            method: isWishlisted ? 'DELETE' : 'POST',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (response.redirected) {
            window.location.href = response.url;
            return;
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
            showWishlistMessage(data.message || 'Unable to update wishlist.', true);
            return;
        }

        const updatedState = data.added === true
            || data.alreadyExists === true
            || (isWishlisted && data.removed !== true);
        const icon = button.querySelector('.wishlist-icon');

        button.dataset.wishlisted = String(updatedState);
        button.setAttribute('aria-pressed', String(updatedState));
        button.setAttribute(
            'aria-label',
            updatedState ? 'Remove from wishlist' : 'Add to wishlist'
        );

        if (icon) {
            icon.classList.toggle('bi-heart-fill', updatedState);
            icon.classList.toggle('bi-heart', !updatedState);
            icon.classList.toggle('text-danger', updatedState);
        }

        const countElements = document.querySelectorAll('#wishlist-count');
        if (Number.isInteger(data.count)) {
            countElements.forEach(function (countElement) {
                countElement.replaceChildren(
                    document.createTextNode(String(data.count)),
                    Object.assign(document.createElement('span'), {
                        className: 'visually-hidden',
                        textContent: 'items in wishlist'
                    })
                );
                countElement.classList.toggle('d-none', data.count === 0);
            });
        }

        showWishlistMessage(data.message, false);
    } catch (error) {
        console.error('Wishlist error:', error);
        showWishlistMessage('Something went wrong. Please try again.', true);
    } finally {
        button.disabled = false;
    }
});

function showWishlistMessage(message, isError) {
    let container = document.getElementById('wishlist-message-container');

    if (!container) {
        container = document.createElement('div');
        container.id = 'wishlist-message-container';
        container.className = 'container pt-3';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.querySelector('main')?.prepend(container);

        if (!container.isConnected) {
            document.body.prepend(container);
        }
    }

    container.replaceChildren();

    const alert = document.createElement('div');
    alert.className = `alert alert-${isError ? 'danger' : 'success'} alert-dismissible fade show`;
    alert.setAttribute('role', isError ? 'alert' : 'status');
    alert.textContent = message;

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn-close';
    closeButton.setAttribute('data-bs-dismiss', 'alert');
    closeButton.setAttribute('aria-label', 'Close');
    alert.append(closeButton);
    container.append(alert);

    window.clearTimeout(window.wishlistMessageTimer);
    window.wishlistMessageTimer = window.setTimeout(function () {
        alert.remove();
    }, 5000);
}
