
Para tu MVP, voy a proponerte una **alternativa de "costo casi cero"** para la mensajería que cumple el objetivo sin pagar API de WhatsApp (usando un enlace pre-generado que el admin solo da click y envía).

A continuación, estructuro los **Requisitos de Software (Ingeniería de Requisitos)** basados en tus respuestas. Esto te servirá como el documento base para desarrollo.

***

# Documento de Definición de Requisitos: Sistema de Gestión de Turnos de Caddies (MVP)

## 1. Visión General del Proyecto

Desarrollar una aplicación web ligera para digitalizar la gestión manual de listas de caddies en el campo de golf. El objetivo principal es eliminar el papel, centralizar la información de los 3 grupos de caddies (listas), automatizar el orden de turnos y generar reportes diarios de asistencia y actividad.

**Prioridad:** Minimizar costos operativos y de infraestructura.
**Usuarios:**

* **Administrador (Caddie Master):** Usuario único que opera el sistema.
* **Caddies:** Usuarios pasivos que solo reciben información (vía WhatsApp) o consultan visualmente, sin interactuar con la app en esta fase.

***

## 2. Requisitos Funcionales (RF)

### Módulo 1: Gestión de Trabajadores (Caddies)

* **RF-1.1 CRUD de Caddies:** El sistema debe permitir crear, editar y desactivar (borrado lógico) caddies.
* **RF-1.2 Atributos del Caddie:** Cada caddie tendrá: Nombre completo, Estado (Activo/Inactivo), Categoría (Lista 1, Lista 2, Lista 3) y un ID interno.
* **RF-1.3 Asignación única:** Un caddie solo puede pertenecer a una categoría a la vez.


### Módulo 2: Gestión de Listas y Turnos (Core)

* **RF-2.1 Visualización de Listas:** El sistema debe mostrar tres listas independientes (1ª, 2ª y 3ª), ordenadas por la posición actual de turno (1, 2, 3...).
* **RF-2.2 Lógica FIFO Estricta:** El orden de salida a turno debe ser siempre el orden de la lista. El sistema debe sugerir siempre al caddie en la posición \#1 como el siguiente a salir.
* **RF-2.3 Registro de Salida a Turno:** El administrador debe poder marcar que un caddie "Salió a cargar". Al hacerlo:
    * El caddie cambia de estado a "En campo".
    * Se registra la hora de salida.
    * La lista se recorre (el \#2 pasa a ser \#1).
* **RF-2.4 Retorno de Turno (Repetición):** El sistema debe permitir reintegrar a un caddie que terminó su vuelta. Este debe ingresar al final de la lista actual de disponibles (cola).


### Módulo 3: Control de Asistencia y Llamado a Lista

* **RF-3.1 Configuración de Horas de Llamado:** El sistema debe permitir definir una hora de "Llamado a lista" específica para cada una de las 3 listas.
* **RF-3.2 Interfaz de Llamado a Lista:** A la hora configurada, el sistema debe habilitar una vista de chequeo rápido donde el admin marca el estado de cada caddie esperado.
* **RF-3.3 Estados de Asistencia:** Los estados seleccionables deben ser:

1. **Presente:** Mantiene su posición.
2. **Llegó tarde:** Se mueve automáticamente al final de la lista (penalización).
3. **No vino:** Se marca como ausente y sale de la lista de disponibles por el día.
4. **Permiso/Otro:** Se registra pero no cuenta como falta injustificada.
* **RF-3.4 Salto Automático:** Si un caddie no está presente al momento de su turno (o no llegó al llamado), el sistema debe permitir "saltarlo" fácilmente para asignar el turno al siguiente.


### Módulo 4: Comunicación (Semi-Automática / Costo Cero)

* **RF-4.1 Generador de Mensajes WhatsApp:** El sistema debe generar texto pre-formateado con la información clave (ej: "⛳ *Turno Actual Lista 1*: Va el caddie \#5 - Juan Perez").
* **RF-4.2 Botón "Click-to-Chat":** El sistema debe tener un botón que abra la API web de WhatsApp (`wa.me/?text=...`) con el mensaje precargado, listo para que el admin solo dé "Enviar" al grupo. *Esto evita pagar la API Business y programar bots complejos.*


### Módulo 5: Reportes

* **RF-5.1 Cierre Diario:** El sistema debe generar un corte diario.
* **RF-5.2 Exportación a Excel:** El sistema debe generar un archivo `.xlsx` o `.csv` descargable con las columnas:
    * Fecha
    * Nombre Caddie
    * Lista
    * Hora Entrada (Llamado)
    * Estado (Presente/Tarde/Falta)
    * Turnos realizados (Cantidad)
    * Hora Salida (Fin jornada)

***

## 3. Requisitos No Funcionales (RNF)

* **RNF-1 Disponibilidad:** El sistema debe estar disponible 24/7, pero es crítico entre 5:00 AM y 6:00 PM.
* **RNF-2 Interfaz Móvil:** El diseño debe ser *Mobile First*. El Caddie Master usará esto de pie, en un celular o tablet, probablemente bajo el sol. Botones grandes, textos claros, alto contraste.
* **RNF-3 Conectividad Intermitente:** El sistema debe ser ligero para cargar rápido con datos móviles (3G/4G).


***

## 4. Reglas de Negocio (Constraints)

1. **Regla de Penalización por Retardo:** Si un caddie llega después de la hora de llamado, pierde su puesto y va al final de la cola de disponibles ese día.
2. **Regla de Inasistencia:** Si no viene, no aparece en la lista de turnos activos.
3. **Regla de Turno Único:** Un caddie no puede estar en estado "En campo" y "Disponible" al mismo tiempo.

