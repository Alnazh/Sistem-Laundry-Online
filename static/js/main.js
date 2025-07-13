(function ($) {
    "use strict";

    // Spinner
    var spinner = function () {
        setTimeout(function () {
            if ($('#spinner').length > 0) {
                $('#spinner').removeClass('show');
            }
        }, 1);
    };
    spinner(0);
    
    // Initiate the wowjs
    new WOW().init();

    // Sticky Navbar
    $(window).scroll(function () {
        if ($(this).scrollTop() > 45) {
            $('.navbar').addClass('sticky-top shadow-sm');
        } else {
            $('.navbar').removeClass('sticky-top shadow-sm');
        }
    });

    // Back to top button
    $(window).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $('.back-to-top').fadeIn('slow');
        } else {
            $('.back-to-top').fadeOut('slow');
        }
    });
    $('.back-to-top').click(function () {
        $('html, body').animate({scrollTop: 0}, 1500, 'easeInOutExpo');
        return false;
    });

    // Order Status Functionality
    function initOrderStatus() {
        $('#orderStatusForm').on('submit', function(e) {
            e.preventDefault();
            
            const orderNumber = $(this).find('input').eq(0).val();
            const phoneNumber = $(this).find('input').eq(1).val();
            
            if (!orderNumber || !phoneNumber) {
                alert('Harap masukkan nomor pesanan dan nomor telepon');
                return;
            }
            
            // Show loading state
            $('#spinner').addClass('show');
            
            // AJAX call to check order status
            $.ajax({
                url: '/api/check-order-status',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    order_number: orderNumber,
                    phone: phoneNumber
                }),
                success: function(response) {
                    if (response.success) {
                        displayOrderDetails(response.order);
                    } else {
                        alert(response.message || 'Pesanan tidak ditemukan');
                    }
                },
                error: function(xhr, status, error) {
                    alert('Terjadi kesalahan saat memeriksa status pesanan');
                    console.error(error);
                },
                complete: function() {
                    $('#spinner').removeClass('show');
                }
            });
        });
    }

    function displayOrderDetails(order) {
        // Update basic order info
        $('#orderNumber').text(order.order_number);
        $('#orderDate').text(new Date(order.order_date).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }));
        $('#estimatedCompletion').text(new Date(order.estimated_completion).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }));
        
        // Update progress bar based on status
        const statusProgress = {
            'pending': 10,
            'processing': 25,
            'washing': 40,
            'drying': 60,
            'ironing': 80,
            'ready-for-delivery': 90,
            'delivered': 100,
            'cancelled': 0
        };
        
        const progress = statusProgress[order.status] || 0;
        const $progressBar = $('.progress-bar');
        $progressBar.css('width', progress + '%');
        $progressBar.text(progress + '% Selesai');
        
        // Update status color based on progress
        if (progress < 30) {
            $progressBar.removeClass('bg-success bg-warning').addClass('bg-danger');
        } else if (progress < 70) {
            $progressBar.removeClass('bg-success bg-danger').addClass('bg-warning');
        } else {
            $progressBar.removeClass('bg-warning bg-danger').addClass('bg-success');
        }
        
        // Update status steps
        const statusOrder = ['pending', 'processing', 'washing', 'drying', 'ironing', 'ready-for-delivery', 'delivered'];
        const currentStatusIndex = statusOrder.indexOf(order.status);
        
        $('.step').each(function(index) {
            const $step = $(this);
            const $icon = $step.find('.step-icon i');
            
            $step.removeClass('completed active');
            $icon.removeClass('fa-check fa-sync-alt fa-spin far fa-clock').addClass('far fa-clock');
            
            if (index < currentStatusIndex) {
                $step.addClass('completed');
                $icon.removeClass('far fa-clock').addClass('fa-check');
            } else if (index === currentStatusIndex) {
                $step.addClass('active');
                if (order.status === 'delivered') {
                    $icon.removeClass('far fa-clock').addClass('fa-check');
                } else {
                    $icon.removeClass('far fa-clock').addClass('fa-sync-alt fa-spin');
                }
            }
        });
        
        // Show order details section
        $('.order-details').fadeIn();
        
        // Scroll to results
        $('html, body').animate({
            scrollTop: $('#orderStatusResult').offset().top - 100
        }, 500);
    }

    // Initialize when document is ready
    $(document).ready(function() {
        initOrderStatus();
    });

    function showLaundryReceipt(event) {
        event.preventDefault();
        
        // Ambil nilai dari form menggunakan jQuery
        const data = {
            name: $('#name').val(),
            phone: $('#phone').val(),
            email: $('#email').val(),
            address: $('#address').val(),
            'service-type': $('#service-type').val(),
            'service-speed': $('#service-speed').val(),
            weight: $('#weight').val(),
            'special-item-name': $('#special-item-name').val() || '',
            'pickup-date': $('#pickup-date').val(),
            'pickup-time': $('#pickup-time').val(),
            'promo-code': $('#promo-code').val(),
            notes: $('#notes').val()
        };
        
        // Validasi form
        const requiredFields = ['name', 'phone', 'address', 'weight', 'pickup-date', 'pickup-time'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        if (missingFields.length > 0) {
            alert(`Harap lengkapi field berikut: ${missingFields.join(', ')}`);
            return false;
        }
        
        const weight = parseFloat(data.weight);
        if (isNaN(weight) || weight < 3) {
            alert('Minimum berat pesanan adalah 3 kg');
            return false;
        }

        // Hitung harga
        const totalPrice = calculateLaundryPrice(data['service-type'], data['service-speed'], weight);
        
        // Tampilkan data di struk
        document.getElementById('receipt-name').textContent = data.name;
        document.getElementById('receipt-phone').textContent = data.phone;
        document.getElementById('receipt-address').textContent = data.address;
        document.getElementById('receipt-pickup-date').textContent = data['pickup-date'];
        document.getElementById('receipt-pickup-time').textContent = data['pickup-time'];
        
        // Format tanggal
        const today = new Date();
        document.getElementById('receipt-date').textContent = today.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        
        // Generate nomor pesanan acak
        const orderNumber = 'GL' + Math.floor(1000 + Math.random() * 9000);
        document.getElementById('receipt-order-number').textContent = orderNumber;
        
        // Isi detail pesanan
        const receiptItems = document.getElementById('receipt-items');
        receiptItems.innerHTML = `
            <tr>
                <td>${getServiceName(data['service-type'])}</td>
                <td>${getSpeedName(data['service-speed'])}</td>
                <td>${data.weight} kg</td>
                <td>Rp ${totalPrice.toLocaleString('id-ID')}</td>
            </tr>
        `;
        
        // Tampilkan total
        document.getElementById('receipt-total').textContent = 'Rp ' + totalPrice.toLocaleString('id-ID');
        
        // Kirim data ke server
        sendOrderDataToServer({
            ...data,
            order_number: orderNumber,
            total_price: totalPrice,
            order_date: today.toISOString()
        });
        
        // Tampilkan modal struk
        const modal = new bootstrap.Modal(document.getElementById('orderReceiptModal'));
        modal.show();
        
        // Notifikasi sukses
        alert('Pesanan berhasil dibuat! Silakan cetak struk untuk referensi Anda.');
    }

    function getServiceName(serviceType) {
        const services = {
            'wash-iron': 'Cuci Setrika',
            'wash-only': 'Cuci Kering',
            'iron-only': 'Setrika Saja',
            'dry-clean': 'Dry Cleaning',
            'special-items': 'Barang Khusus'
        };
        return services[serviceType] || serviceType;
    }

    function getSpeedName(speedType) {
        const speeds = {
            'express': 'Express (6 jam)',
            'regular': 'Reguler (1 hari)',
            'economy': 'Ekonomis (4 hari)'
        };
        return speeds[speedType] || speedType;
    }

    function calculateLaundryPrice(serviceType, serviceSpeed, weight) {
        const prices = {
            'wash-iron': { express: 13000, regular: 10000, economy: 7000 },
            'wash-only': { express: 11000, regular: 8000, economy: 5000 },
            'iron-only': { express: 10000, regular: 7000, economy: 4000 },
            'dry-clean': { express: 35000, regular: 30000, economy: 25000 },
            'special-items': { express: 50000, regular: 40000, economy: 30000 }
        };
        
        const pricePerKg = prices[serviceType]?.[serviceSpeed] || 0;
        return weight * pricePerKg;
    }

    // sendOrderDataToServer function
    function sendOrderDataToServer(orderData) {
        $.ajax({
            url: '/api/submit-order',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                'name': orderData.name,
                'email': orderData.email,
                'phone': orderData.phone,
                'address': orderData.address,
                'service-type': orderData['service-type'],
                'service-speed': orderData['service-speed'],
                'weight': orderData.weight,
                'special-item-name': orderData['special-item-name'],
                'pickup-date': orderData['pickup-date'],
                'pickup-time': orderData['pickup-time'],
                'promo-code': orderData['promo-code'],
                'notes': orderData.notes
            }),
            success: function(response) {
                console.log('Order submitted successfully:', response);
                if (response.order_number) {
                    document.getElementById('receipt-order-number').textContent = response.order_number;
                }
            },
            error: function(xhr, status, error) {
                console.error('Error submitting order:', error);
                alert('Terjadi kesalahan saat menyimpan pesanan. Silakan coba lagi.');
            }
        });
    }

    // Fungsi untuk toggle special item field
    function toggleSpecialItemField() {
        const serviceType = document.getElementById('service-type');
        const specialItemField = document.getElementById('special-item-field');
        
        if (serviceType.value === 'special-items') {
            specialItemField.style.display = 'block';
        } else {
            specialItemField.style.display = 'none';
        }
    }

        // Inisialisasi saat dokumen siap
        $(document).ready(function() {
        initOrderStatus();
        
        // Inisialisasi form pemesanan
        $('#laundryOrderForm').on('submit', function(e) {
            e.preventDefault();
            showLaundryReceipt(e);
        });

        // Event listener untuk tombol cetak
        $('#print-receipt').on('click', function() {
            window.print();
        });
        
        // Toggle special item field
        toggleSpecialItemField();
        $('#service-type').on('change', toggleSpecialItemField);
        
        // Set tanggal minimal untuk penjemputan (hari ini)
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('pickup-date').min = today;
    });

        $(document).ready(function(){
        // Inisialisasi testimonial carousel
        $('.testimonial-carousel').owlCarousel({
            loop: true,
            margin: 20,
            nav: false,
            dots: true,
            autoplay: true,
            responsive: {
                0: {
                    items: 1
                },
                768: {
                    items: 2
                },
                992: {
                    items: 3
                }
            }
        });
        $('#printStrukBtn').on('click', function() {
            fillOrderReceipt();
            const receiptModal = new bootstrap.Modal(document.getElementById('orderReceiptModal'));
            receiptModal.show();
        });

        setupPrintReceipt();
        
        // Hapus event listener untuk print-invoice jika ada
        $('#print-invoice').off('click');
    });


    // Fungsi untuk mengisi data struk pesanan
    function fillOrderReceipt() {
        // Ambil data dari halaman status pesanan
        const orderNumber = $('#orderNumber').text() || 'GL-XXXXXX';
        const orderDate = $('#orderDate').text() || new Date().toLocaleDateString('id-ID');
        const estimatedCompletion = $('#estimatedCompletion').text() || '-';
        const progressText = $('.progress-bar').text() || '0% Selesai';
        
        // Ambil data layanan dari tabel
        const services = [];
        $('.order-details table tbody tr').each(function() {
            if (!$(this).hasClass('fw-bold')) { // Skip row total
                const cells = $(this).find('td');
                services.push({
                    name: cells.eq(0).text(),
                    weight: cells.eq(1).text(),
                    price: cells.eq(2).text(),
                    subtotal: cells.eq(3).text()
                });
            }
        });

        // Isi data ke modal struk
        $('#receipt-order-number').text(orderNumber);
        $('#receipt-date').text(orderDate);
        $('#receipt-estimated-completion').text(estimatedCompletion);
        $('#receipt-progress').text(progressText);
        
        // Isi item layanan
        const receiptItems = $('#receipt-items');
        receiptItems.empty();
        services.forEach(service => {
            receiptItems.append(`
                <tr>
                    <td>${service.name}</td>
                    <td>${service.weight}</td>
                    <td>${service.price}</td>
                    <td>${service.subtotal}</td>
                </tr>
            `);
        });

        // Update progress bar di modal
        const progress = parseInt($('.progress-bar').css('width'));
        $('#receipt-progress-bar').css('width', progress + '%').text(progress + '%');
    }

    // Fungsi untuk mencetak struk
    function setupPrintReceipt() {
        $(document).on('click', '#print-receipt', function() {
            const printContent = $('#orderReceiptModal .modal-content').clone();
            printContent.find('.modal-footer').remove();
            
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Struk Pesanan GoLaundry</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.0/dist/css/bootstrap.min.css" rel="stylesheet">
                    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.15.4/css/all.css">
                    <style>
                        @media print {
                            body { padding: 20px; }
                            .progress { -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    ${printContent.html()}
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(() => window.close(), 1000);
                        };
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        });
    }

}) (jQuery);