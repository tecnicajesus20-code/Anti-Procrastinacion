export class TaskFirestoreMapper {
  static toDomain(id, data) {
    return {
      id: id,
      title: data.title || '',
      description: data.description || null,
      status: data.status || 'pending',
      dueDate: data.dueDate || null,
      start: data.start, // Obligatorio según tu dominio
      end: data.end      // Obligatorio según tu dominio
    };
  }

  static toFirestore(task) {
    return {
      title: task.title,
      description: task.description || null,
      status: task.status || 'pending',
      dueDate: task.dueDate || null,
      start: task.start,
      end: task.end,
      userId: task.userId,
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}