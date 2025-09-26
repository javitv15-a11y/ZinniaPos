import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

// Si tienes ProductService, se puede usar solo para el nombre.
// Si no existe, quita esta importación y el uso marcado con "opc".
import { ProductService } from 'src/app/core/services/bussiness/product.service';

type MoveType = 'entrada' | 'salida';

interface UIMovement {
  id: string;
  type: MoveType;          // 'entrada' | 'salida'
  qty: number;             // cantidad (positiva en ambos casos para mostrar)
  date: Date;              // fecha normalizada
  title: string;           // "Salida: Venta #B005" | "Entrada: +15"
  metaLeft: string;        // ej. "15 de ago, 2024"
  metaRight: string;       // ej. "Venta #B005   Cliente: Juan López"
}

@Component({
  selector: 'app-inventory-movements',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
  templateUrl: './inventory-movements.component.html',
  styleUrls: ['./inventory-movements.component.scss'],
})
export class InventoryMovementsComponent implements OnInit, OnDestroy {

  constructor(
    private route: ActivatedRoute,
    // opc: si no tienes servicio, puedes comentar la siguiente línea sin problemas
    private productsSrv: ProductService,
  ) {}

  loading = true;
  error?: string;

  productId = '';
  productName = 'Producto';
  items: UIMovement[] = [];

  private sub?: Subscription;

  // Href del botón back (vuelve al detalle)
  get backHref() { return this.productId ? `/inventory/${this.productId}` : '/inventory'; }

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe(async (pm) => {
      const id = pm.get('id');
      if (!id) { this.error = 'Falta el id del producto.'; this.loading = false; return; }
      this.productId = id;

      // si te pasan ?name=Laptop Lenovo en la url, úsalo.
      const qpName = this.route.snapshot.queryParamMap.get('name');
      if (qpName) this.productName = qpName;

      await this.load();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  // ========= MOCK: datos fijos como tu captura =========
  private mockMovements(): UIMovement[] {
    const raw = [
      { type: 'salida',  qty: 1,  date: '2024-08-15', ref: 'Venta #B005', customer: 'Juan López' },
      { type: 'entrada', qty: 15, date: '2024-09-03', ref: 'Compra proveedor', supplier: 'Tecnología' },
      { type: 'salida',  qty: 1,  date: '2024-10-22', ref: 'Venta #B004', customer: 'Ana Pérez' },
      { type: 'entrada', qty: 10, date: '2024-10-18', ref: 'Compra proveedor' },
    ];

    return raw.map((m, i) => {
      const d = new Date(m.date);
      const metaLeft = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
      const parts: string[] = [];
      if (m.ref) parts.push(m.ref);
      if (m.customer) parts.push(`Cliente: ${m.customer}`);
      if (m.supplier) parts.push(`Proveedor ${m.supplier}`);
      const metaRight = parts.join('   ');

      const title = m.type === 'salida'
        ? (m.ref ? `Salida: ${m.ref}` : `Salida: -${Math.abs(m.qty)}`)
        : `Entrada: +${Math.abs(m.qty)}`;

      return {
        id: String(i + 1),
        type: m.type,
        qty: Math.abs(m.qty),
        date: d,
        title,
        metaLeft,
        metaRight,
      } as UIMovement;
    });
  }

  // ========= Carga: usa MOCK; intenta leer nombre real del producto si existe el servicio =========
  async load() {
    this.loading = true;
    this.error = undefined;
    try {
      // (opc) intenta obtener nombre real del producto si el servicio existe
      try {
        if (this.productsSrv && typeof this.productsSrv.getById === 'function') {
          const p: any = await this.productsSrv.getById(this.productId);
          const n = (p?.nombre || p?.name) as string | undefined;
          if (n) this.productName = n;
        }
      } catch { /* ignore */ }

      // Movimientos: SOLO MOCK (hardcode)
      this.items = this.mockMovements();
    } catch (e: any) {
      this.error = e?.message || 'No se pudo cargar el historial.';
      this.items = [];
    } finally {
      this.loading = false;
    }
  }

  // Placeholder por si luego agregas acción al tocar un movimiento
  openMovement(_m: UIMovement) {}
}
