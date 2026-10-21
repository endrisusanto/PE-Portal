import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './Button';
import styles from './EmptyState.module.css';

export const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No items found',
  description = 'There are no records to display at this time.',
  actionLabel,
  onAction,
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.iconWrapper}>
        <Icon size={32} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="outline" size="sm" className={styles.action}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
