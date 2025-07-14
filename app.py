from urllib import request
from flask import Flask, jsonify, render_template, redirect, url_for, flash, request
from flask_sqlalchemy import SQLAlchemy
from flask_wtf import FlaskForm
from wtforms import StringField, EmailField, SelectField, TextAreaField, SubmitField
from wtforms.validators import DataRequired, Email
import os
from datetime import datetime, timedelta  # <-- INI YANG DITAMBAHKAN

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///orders.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Database Models
class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    address = db.Column(db.Text, nullable=False)
    orders = db.relationship('Order', backref='customer', lazy=True)

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_number = db.Column(db.String(20), unique=True, nullable=False)
    service_type = db.Column(db.String(50), nullable=False)
    service_speed = db.Column(db.String(20), nullable=False)
    weight = db.Column(db.Float, nullable=False)
    special_item = db.Column(db.String(100))
    pickup_date = db.Column(db.DateTime, nullable=False)
    pickup_time = db.Column(db.String(20), nullable=False)
    notes = db.Column(db.Text)
    promo_code = db.Column(db.String(20))
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)

# Forms
class OrderForm(FlaskForm):
    name = StringField('Nama Lengkap', validators=[DataRequired()])
    email = EmailField('Email', validators=[DataRequired(), Email()])
    phone = StringField('Nomor Telepon', validators=[DataRequired()])
    address = TextAreaField('Alamat Lengkap', validators=[DataRequired()])
    service_type = SelectField('Jenis Layanan', choices=[
        ('wash-iron', 'Cuci Setrika'),
        ('wash-only', 'Cuci Kering'),
        ('iron-only', 'Setrika Saja'),
        ('dry-clean', 'Dry Cleaning'),
        ('special-items', 'Barang Khusus')
    ], validators=[DataRequired()])
    service_speed = SelectField('Kecepatan Layanan', choices=[
        ('express', 'Express (6 jam)'),
        ('regular', 'Reguler (1 hari)'),
        ('economy', 'Ekonomis (4 hari)')
    ], validators=[DataRequired()])
    special_item_name = StringField('Nama Barang Khusus')
    weight = StringField('Berat (kg)', validators=[DataRequired()])
    promo_code = StringField('Kode Promo (Opsional)')
    pickup_date = StringField('Tanggal Penjemputan', validators=[DataRequired()])
    pickup_time = StringField('Waktu Penjemputan', validators=[DataRequired()])
    notes = TextAreaField('Catatan Khusus')
    submit = SubmitField('Pesan Sekarang')

class OrderStatusForm(FlaskForm):
    order_number = StringField('Order Number', validators=[DataRequired()])
    email = EmailField('Email', validators=[DataRequired(), Email()])
    submit = SubmitField('Check Status')

# Create database tables
with app.app_context():
    db.create_all()

@app.route('/order', methods=['GET', 'POST'])
def order():
    form = OrderForm()
    if form.validate_on_submit():
        try:
            # Check if customer exists
            customer = Customer.query.filter_by(phone=form.phone.data).first()
            if not customer:
                customer = Customer(
                    name=form.name.data,
                    email=form.email.data,
                    phone=form.phone.data,
                    address=form.address.data
                )
                db.session.add(customer)
                db.session.commit()
            
            # Generate order number with date prefix
            today = datetime.now().strftime("%Y%m%d")
            order_count = Order.query.filter(Order.order_number.like(f'GL-{today}-%')).count() + 1
            order_number = f"GL-{today}-{order_count:03d}"
            
            # Parse pickup date and time
            pickup_date = datetime.strptime(form.pickup_date.data, '%Y-%m-%d')
            
            # Create order
            order = Order(
                order_number=order_number,
                service_type=form.service_type.data,
                service_speed=form.service_speed.data,
                weight=float(form.weight.data),
                special_item=form.special_item_name.data if form.service_type.data == 'special-items' else None,
                pickup_date=pickup_date,
                pickup_time=form.pickup_time.data,
                notes=form.notes.data,
                promo_code=form.promo_code.data,
                customer_id=customer.id
            )
            db.session.add(order)
            db.session.commit()
            
            flash(f'Pesanan berhasil dibuat! Nomor pesanan Anda: {order_number}', 'success')
            return redirect(url_for('product', order_number=order_number))
        except Exception as e:
            db.session.rollback()
            flash('Terjadi kesalahan saat memproses pesanan Anda. Silakan coba lagi.', 'danger')
            app.logger.error(f"Error processing order: {str(e)}")
    
    return render_template('contact.html', form=form)

@app.route('/order/status', methods=['GET', 'POST'])
@app.route('/order/status/<order_number>', methods=['GET'])
def order_status(order_number=None):
    form = OrderStatusForm()
    order = None
    
    if order_number:
        order = Order.query.filter_by(order_number=order_number).first()
    
    if form.validate_on_submit():
        order = Order.query.filter_by(
            order_number=form.order_number.data
        ).join(Customer).filter(
            Customer.email == form.email.data
        ).first()
        
        if not order:
            flash('Order not found. Please check your order number and email.', 'danger')
    
    return render_template('order_status.html', form=form, order=order)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/service')
def service():
    return render_template('service.html')

@app.route('/blog')
@app.route('/blog/<int:page>')
def blog(page=1):
    return render_template('blog.html', current_page=page)

@app.route('/api/articles')
def api_articles():
    page = request.args.get('page', 1, type=int)
    per_page = 9  # Jumlah artikel per halaman
    
    # Contoh data artikel - dalam implementasi nyata, ini bisa dari database
    all_articles = [
        {"id": i, "title": f"Artikel {i}", "content": f"Ini adalah konten artikel {i}"} 
        for i in range(1, 28)  # 27 artikel contoh
    ]
    
    # Pagination manual
    start = (page - 1) * per_page
    end = start + per_page
    articles = all_articles[start:end]
    
    return jsonify({
        "articles": articles,
        "total_pages": 3,  # Total halaman (27 artikel / 9 per halaman)
        "current_page": page
    })

@app.route('/feature')
def feature():
    return render_template('feature.html')

@app.route('/product', methods=['GET', 'POST'])
def product():
    order_number = request.args.get('order_number')
    phone = request.form.get('phone') if request.method == 'POST' else None
    
    if request.method == 'POST' and phone:
        # Search order by phone number
        orders = Order.query.join(Customer).filter(Customer.phone == phone)\
            .order_by(Order.created_at.desc()).all()
        if orders:
            return render_template('product.html', orders=orders)
        else:
            flash('Tidak ditemukan pesanan dengan nomor telepon tersebut', 'warning')
    
    if order_number:
        order = Order.query.filter_by(order_number=order_number).first()
        if order:
            return render_template('product.html', orders=[order])
        else:
            flash('Nomor pesanan tidak ditemukan', 'danger')
    
    return render_template('product.html')

@app.route('/team')
def team():
    return render_template('team.html')

@app.route('/testimonial')
def testimonial():
    return render_template('testimonial.html')

@app.route('/404')
def not_found():
    return render_template('404.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

from datetime import datetime, timedelta

@app.template_filter('datetimefilter')
def datetimefilter(value, format='%B %d, %Y'):
    if isinstance(value, int):
        # If it's an ID, use it to generate a pseudo-date for demonstration
        pseudo_date = datetime.now().replace(day=(value % 28) + 1)
        return pseudo_date.strftime(format)
    elif isinstance(value, datetime):
        return value.strftime(format)
    return value

@app.route('/api/check-order-status', methods=['POST'])
def check_order_status():
    data = request.get_json()
    order_number = data.get('order_number')
    phone = data.get('phone')
    
    if not order_number or not phone:
        return jsonify({'success': False, 'message': 'Nomor pesanan dan telepon diperlukan'})
    
    order = Order.query.filter_by(order_number=order_number)\
        .join(Customer).filter(Customer.phone == phone).first()
    
    if not order:
        return jsonify({'success': False, 'message': 'Pesanan tidak ditemukan'})
    
    # Calculate progress based on status
    status_progress = {
        'pending': 10,
        'processing': 30,
        'washing': 50,
        'drying': 70,
        'ironing': 85,
        'ready-for-delivery': 95,
        'delivered': 100
    }
    
    progress = status_progress.get(order.status, 0)
    
    order_data = {
        'order_number': order.order_number,
        'order_date': order.created_at.isoformat(),
        'estimated_completion': (order.created_at + timedelta(days=1)).isoformat(),
        'status': order.status,
        'progress': progress,
        'details': {
            'service_type': order.service_type,
            'service_speed': order.service_speed,
            'weight': order.weight,
            'pickup_date': order.pickup_date.strftime('%d %B %Y'),
            'pickup_time': order.pickup_time
        }
    }
    
    return jsonify({'success': True, 'order': order_data})

@app.route('/api/submit-order', methods=['POST'])
def submit_order():
    try:
        data = request.get_json()
        app.logger.info(f"Received order data: {data}") 
        
        # Validasi data yang diperlukan
        required_fields = ['name', 'phone', 'address', 'service-type', 'service-speed', 'weight', 'pickup-date', 'pickup-time']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'success': False, 'message': f'Field {field} harus diisi'}), 400

        # Cek apakah pelanggan sudah ada
        customer = Customer.query.filter_by(phone=data['phone']).first()
        if not customer:
            customer = Customer(
                name=data['name'],
                email=data.get('email', ''),
                phone=data['phone'],
                address=data['address']
            )
            db.session.add(customer)
            db.session.commit()
        
        # Generate order number yang benar
        today = datetime.now().strftime("%Y%m%d")
        order_count = Order.query.filter(Order.order_number.like(f'GL-{today}-%')).count() + 1
        order_number = f"GL-{today}-{order_count:03d}"
        
        # Parse pickup date
        pickup_date = datetime.strptime(data['pickup-date'], '%Y-%m-%d')
        
        # Buat pesanan baru
        order = Order(
            order_number=order_number,  # Pastikan ini di-set
            service_type=data['service-type'],
            service_speed=data['service-speed'],
            weight=float(data['weight']),
            special_item=data.get('special-item-name', ''),
            pickup_date=pickup_date,
            pickup_time=data['pickup-time'],
            notes=data.get('notes', ''),
            promo_code=data.get('promo-code', ''),
            status='pending',
            customer_id=customer.id
        )
        db.session.add(order)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'order_number': order.order_number,  # Pastikan ini dikembalikan
            'message': 'Pesanan berhasil disimpan'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Error: {str(e)}'
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
else:
    # Untuk eksekusi dengan gunicorn
    gunicorn_app = app